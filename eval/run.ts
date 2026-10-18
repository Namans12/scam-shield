// Runs a case file against a deployed app. Default: eval/cases.jsonl -> eval/results/<timestamp>.raw.json and latest.md.
// Usage: npx tsx eval/run.ts [--base https://...web.app] [--concurrency 1] [--only s01,g02] [--lang en]
//   Eval v2: npx tsx eval/run.ts --cases cases-v2.jsonl --gap 2500 --out run-v2
//   --cases FILE  case file under eval/ (default cases.jsonl)
//   --gap MS      minimum gap between case starts (default 6500)
//   --out NAME    write results/NAME.md (comparison report against the keyword baseline) and results/NAME.raw.json
// Sequential by default: parallel calls trip the Gemini quota on this project (see HANDOFF.md section 10).
// Auth: like the app itself, the runner signs in anonymously (Firebase Auth) and starts a fresh anonymous user after 25
// checks so no single user passes the server's 30-per-day cap. Limits are never bypassed otherwise or edited.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ScamType, Verdict, HardSignal, EntityHit, RedFlag } from "@scam-shield/shared";
import { computeMetrics, type EvalRow } from "./metrics";
import { loadCases, type Case } from "./cases";
import { renderReport, type LiveRow } from "./report";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const arg = (name: string, dflt: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? dflt) : dflt;
};
const BASE = arg("base", "https://project-91260b43-6705-4176-b71.web.app").replace(/\/$/, "");
const CONCURRENCY = Math.max(1, Number(arg("concurrency", "1")));
const ONLY = arg("only", "").split(",").filter(Boolean);
const LANG = arg("lang", "en");
const CASES_FILE = arg("cases", "cases.jsonl");
const OUT = arg("out", "");
const GAP_MS = Math.max(0, Number(arg("gap", "6500")));
const BUCKET = process.env.STORAGE_BUCKET ?? "project-91260b43-6705-4176-b71.firebasestorage.app";
const PER_USER = 25; // the API allows 30 checks per user per day
const API_KEY = /^VITE_FIREBASE_API_KEY=(.*)$/m.exec(readFileSync(resolve(root, "web/.env.production"), "utf8"))![1]!.trim();

const cases: Case[] = loadCases(resolve(here, CASES_FILE));
const selected = ONLY.length ? cases.filter((c) => ONLY.includes(c.id)) : cases;

interface Session { token: string; uid: string; used: number }
let session: Session | null = null;
async function getSession(): Promise<Session> {
  if (session && session.used < PER_USER) { session.used++; return session; }
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ returnSecureToken: true }),
  });
  const j = (await r.json()) as { idToken: string; localId: string };
  session = { token: j.idToken, uid: j.localId, used: 1 };
  return session;
}

async function upload(c: Case, s: Session): Promise<string> {
  const ext = c.asset!.split(".").pop();
  const path = `uploads/${s.uid}/eval-${c.id}-${Date.now()}.${ext}`;
  const r = await fetch(`https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o?name=${encodeURIComponent(path)}`, {
    method: "POST", headers: { authorization: `Firebase ${s.token}`, "content-type": c.mime! }, body: readFileSync(resolve(root, c.asset!)),
  });
  if (!r.ok) throw new Error(`upload ${r.status}`);
  return path;
}

// Pacing: start at most one case every GAP_MS (the API's per-IP limit is generous, but the Gemini quota is not).
let lastStart = 0;
async function pace() {
  const wait = lastStart + GAP_MS - Date.now();
  lastStart = Math.max(Date.now(), lastStart + GAP_MS);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

// Only these are retried, once: the per-IP limiter and upstream failures. daily_limit and 4xx are never retried.
const isTransient = (status: number, err: string) => (status === 429 && err === "rate_limited") || status === 502 || status === 503 || status === 504;

let liveCalls = 0;
type Row = LiveRow;
async function runCase(c: Case): Promise<Row> {
  const base = { id: c.id, label: c.label, category: c.category, scamType: c.scam_type, kind: c.kind };
  let attempts = 0;
  let lastErr = "";
  const retried: string[] = [];
  for (let i = 0; i < 2; i++) {
    attempts++;
    await pace();
    const s = await getSession();
    try {
      const body: Record<string, unknown> = { lang: LANG, ...(c.text && { text: c.text }) };
      if (c.asset) { body.storagePath = await upload(c, s); body.mimeType = c.mime; }
      const t0 = Date.now();
      liveCalls++;
      const r = await fetch(`${BASE}/api/check`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${s.token}` }, body: JSON.stringify(body) });
      const latencyMs = Date.now() - t0;
      const j = (await r.json().catch(() => ({}))) as { verdict?: Verdict; scam_type?: ScamType; risk_score?: number; summary?: string; red_flags?: RedFlag[]; hardSignals?: HardSignal[]; hits?: EntityHit[]; entityKeys?: string[]; error?: string };
      if (r.ok && j.verdict) {
        return {
          ...base, verdict: j.verdict, predictedType: j.scam_type, riskScore: j.risk_score, latencyMs, attempts, summary: j.summary,
          redFlags: (j.red_flags ?? []).map((f) => f.flag), hardSignals: j.hardSignals ?? [], hits: (j.hits ?? []).map((h) => ({ key: h.key, reportCount: h.reportCount })),
          entityKeys: j.entityKeys ?? [], ...(retried.length && { retried }),
        };
      }
      lastErr = `${r.status} ${j.error ?? ""}`.trim();
      if (!isTransient(r.status, j.error ?? "")) break;
      retried.push(lastErr);
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      break; // network-level failures are not retried: record them as they are
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  return { ...base, error: lastErr, attempts, ...(retried.length && { retried }) };
}

const rows: Row[] = [];
let next = 0;
async function worker() {
  while (next < selected.length) {
    const c = selected[next++]!;
    const row = await runCase(c);
    rows.push(row);
    console.log(`${String(rows.length).padStart(2)}/${selected.length} ${c.id} ${c.label.padEnd(9)} -> ${row.error ? "ERROR " + row.error : `${row.verdict} (${row.predictedType}, risk ${row.riskScore}, hard [${(row.hardSignals ?? []).join(",")}]) ${(row.latencyMs! / 1000).toFixed(1)}s`}`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
rows.sort((a, b) => a.id.localeCompare(b.id));

const m = computeMetrics(rows);
const runAt = new Date().toISOString();
const stamp = runAt.replace(/[:.]/g, "-");
mkdirSync(resolve(here, "results"), { recursive: true });
const rawName = OUT ? `${OUT}.raw.json` : `${stamp}.raw.json`;
writeFileSync(resolve(here, `results/${rawName}`), JSON.stringify({ base: BASE, lang: LANG, concurrency: CONCURRENCY, casesFile: CASES_FILE, gapMs: GAP_MS, liveCalls, runAt, metrics: m, rows }, null, 2));

if (OUT) {
  const md = renderReport({ rows, cases, v1Cases: loadCases(resolve(here, "cases.jsonl")), base: BASE, lang: LANG, gapMs: GAP_MS, runAt, liveCalls, casesFile: CASES_FILE });
  writeFileSync(resolve(here, `results/${OUT}.md`), md);
  console.log("\n" + md);
  process.exit(0);
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const flagged = (r: EvalRow) => r.verdict === "scam" || r.verdict === "suspicious";
const missed = rows.filter((r) => r.label === "scam" && !r.error && !flagged(r));
const falsePos = rows.filter((r) => r.label === "legit" && flagged(r));
const md = [
  "# Scam Shield evaluation",
  "",
  `Run: ${runAt} against ${BASE} (language: ${LANG}, concurrency: ${CONCURRENCY}). ${m.n} synthetic cases: ${rows.filter((r) => r.label === "scam").length} scams, ${rows.filter((r) => r.label === "legit").length} genuine.`,
  "A message counts as flagged when the verdict is Scam or Suspicious.",
  "",
  "| Metric | Result |",
  "|---|---|",
  `| Accuracy | ${pct(m.accuracy)} |`,
  `| Scam recall (scams flagged) | ${pct(m.scamRecall)} |`,
  `| False-positive rate (genuine flagged) | ${pct(m.falsePositiveRate)} |`,
  `| Scam type correct (among flagged scams) | ${pct(m.typeAccuracy)} |`,
  `| Errors | ${m.errors} |`,
  "",
  "| Input | p50 latency | p95 latency | Cases |",
  "|---|---|---|---|",
  ...Object.entries(m.latency).map(([k, v]) => `| ${k} | ${(v.p50 / 1000).toFixed(1)} s | ${(v.p95 / 1000).toFixed(1)} s | ${rows.filter((r) => r.kind === k).length} |`),
  "",
  `Missed scams: ${missed.length ? missed.map((r) => `${r.id} (${r.verdict})`).join(", ") : "none"}`,
  `False positives: ${falsePos.length ? falsePos.map((r) => `${r.id} (${r.verdict})`).join(", ") : "none"}`,
  `Errors: ${rows.filter((r) => r.error).map((r) => `${r.id} (${r.error})`).join(", ") || "none"}`,
  "",
  "Cases are in `eval/cases.jsonl`; raw results in `eval/results/`.",
  "",
].join("\n");
writeFileSync(resolve(here, "results/latest.md"), md);
console.log("\n" + md);
