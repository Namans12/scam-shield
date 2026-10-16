// Runs eval/cases.jsonl against a deployed app and writes eval/results/<timestamp>.raw.json and latest.md.
// Usage: npx tsx eval/run.ts [--base https://...web.app] [--concurrency 1] [--only s01,g02] [--lang en]
// Sequential by default: parallel calls trip the Gemini quota on this project (see HANDOFF.md section 10).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ScamType, Verdict } from "@scam-shield/shared";
import { computeMetrics, type EvalRow } from "./metrics";

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
const BUCKET = process.env.STORAGE_BUCKET ?? "project-91260b43-6705-4176-b71.firebasestorage.app";
const PER_USER = 25; // the API allows 30 checks per user per day
const API_KEY = /^VITE_FIREBASE_API_KEY=(.*)$/m.exec(readFileSync(resolve(root, "web/.env.production"), "utf8"))![1]!.trim();

interface Case { id: string; kind: "text" | "image" | "audio"; label: "scam" | "legit"; scam_type?: ScamType; text?: string; asset?: string; mime?: string }
const cases: Case[] = readFileSync(resolve(here, "cases.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
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

// The API allows 10 checks per minute per IP: start at most one case every 6.5 s so the run never trips it.
const MIN_GAP_MS = 6500;
let lastStart = 0;
async function pace() {
  const wait = lastStart + MIN_GAP_MS - Date.now();
  lastStart = Math.max(Date.now(), lastStart + MIN_GAP_MS);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

async function runCase(c: Case): Promise<EvalRow & { attempts: number; riskScore?: number }> {
  const base = { id: c.id, label: c.label, scamType: c.scam_type, kind: c.kind };
  let attempts = 0;
  let lastErr = "";
  for (let i = 0; i < 2; i++) {
    attempts++;
    await pace();
    const s = await getSession();
    try {
      const body: Record<string, unknown> = { lang: LANG, ...(c.text && { text: c.text }) };
      if (c.asset) { body.storagePath = await upload(c, s); body.mimeType = c.mime; }
      const t0 = Date.now();
      const r = await fetch(`${BASE}/api/check`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${s.token}` }, body: JSON.stringify(body) });
      const latencyMs = Date.now() - t0;
      const j = (await r.json().catch(() => ({}))) as { verdict?: Verdict; scam_type?: ScamType; risk_score?: number; error?: string };
      if (r.ok && j.verdict) return { ...base, verdict: j.verdict, predictedType: j.scam_type, riskScore: j.risk_score, latencyMs, attempts };
      lastErr = `${r.status} ${j.error ?? ""}`.trim();
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  return { ...base, error: lastErr, attempts };
}

const rows: Array<EvalRow & { attempts: number; riskScore?: number }> = [];
let next = 0;
async function worker() {
  while (next < selected.length) {
    const c = selected[next++]!;
    const row = await runCase(c);
    rows.push(row);
    console.log(`${String(rows.length).padStart(2)}/${selected.length} ${c.id} ${c.label.padEnd(5)} -> ${row.error ? "ERROR " + row.error : `${row.verdict} (${row.predictedType}, risk ${row.riskScore}) ${(row.latencyMs! / 1000).toFixed(1)}s`}`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
rows.sort((a, b) => a.id.localeCompare(b.id));

const m = computeMetrics(rows);
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
mkdirSync(resolve(here, "results"), { recursive: true });
writeFileSync(resolve(here, `results/${stamp}.raw.json`), JSON.stringify({ base: BASE, lang: LANG, concurrency: CONCURRENCY, metrics: m, rows }, null, 2));

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const flagged = (r: EvalRow) => r.verdict === "scam" || r.verdict === "suspicious";
const missed = rows.filter((r) => r.label === "scam" && !r.error && !flagged(r));
const falsePos = rows.filter((r) => r.label === "legit" && flagged(r));
const md = [
  "# Scam Shield evaluation",
  "",
  `Run: ${new Date().toISOString()} against ${BASE} (language: ${LANG}, concurrency: ${CONCURRENCY}). ${m.n} synthetic cases: ${rows.filter((r) => r.label === "scam").length} scams, ${rows.filter((r) => r.label === "legit").length} genuine.`,
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
