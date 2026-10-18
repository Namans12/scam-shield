// The single source for Scam Shield's headline benchmark numbers.
// Reads eval/results/official.json (the list of OFFICIAL raw run files), joins every raw row to its case file for the
// label / category / scam type, computes the COMBINED metrics over all runs, and writes
//   eval/results/combined.md              human readable (same table style as latest.md; parseable by video/scripts/bench.mjs and scripts/build-deck.py)
//   web/src/benchmark.generated.json      the strings the landing page shows (web/src/benchmark.ts imports it)
// Usage: npx tsx eval/aggregate.ts            write both files
//        npx tsx eval/aggregate.ts --check    recompute and fail (exit 1) if either file is out of date, writing nothing
//
// Definitions (identical to eval/metrics.ts, see countRows): ambiguous cases are left out of the two-class metrics; "flagged"
// is a Scam or Suspicious verdict; accuracy = correct / (scams + genuine), where a row with an error is always wrong;
// scam recall = flagged scams / all scams (an error is a miss); false-positive rate = flagged genuine / genuine rows that got an answer.
//
// Percentage formatting (formatPct), always from exact integer counts, never from an already rounded ratio:
//   - round half up to one decimal (12.5 -> "12.5", 6.25 -> "6.3", 1/3 -> "33.3");
//   - exactly 0 is "0" and exactly 100 is "100"; every other value keeps one decimal ("5.0", "97.6");
//   - a non-zero value is never shown as 0 (0.04 -> "0.1") and a value below 100 is never shown as 100 (99.96 -> "99.9"),
//     so one miss or one false positive always shows;
//   - an empty denominator gives "0".
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { countRows, isFlagged, latencyStats, percentile, tally, type Counts, type EvalRow, type Metrics } from "./metrics";
import { loadCases, type Case } from "./cases";

const here = dirname(fileURLToPath(import.meta.url));
export const MANIFEST_PATH = resolve(here, "results/official.json");
export const COMBINED_MD_PATH = resolve(here, "results/combined.md");
export const GENERATED_JSON_PATH = resolve(here, "../web/src/benchmark.generated.json");

export interface ManifestRun {
  /** Short name used in tables, e.g. "v1". */
  name: string;
  /** Raw result file, relative to the manifest. */
  raw: string;
  /** Case file the raw rows join to, relative to the manifest. */
  cases: string;
  /** ISO time of the run. Used when the raw file has no runAt (the first run predates it). */
  runAt: string;
  description?: string;
}
export interface Manifest { runs: ManifestRun[] }

export interface RunData {
  name: string;
  runAt: string;
  base: string;
  rows: EvalRow[];
}

export interface Generated {
  accuracy: string;
  recall: string;
  falsePositive: string;
  cases: string;
  scams: string;
  genuine: string;
  ambiguous: string;
}

// ---------- formatting ----------

/** Percentage of num/den as the string shown to people. See the rules at the top of the file. */
export function formatPct(num: number, den: number): string {
  if (!Number.isInteger(num) || !Number.isInteger(den) || num < 0 || den < 0 || num > den) throw new RangeError(`formatPct(${num}, ${den}): need integers with 0 <= num <= den`);
  if (den === 0 || num === 0) return "0";
  if (num === den) return "100";
  // tenths of a percent, rounded half up, in integer arithmetic: floor(num * 1000 / den + 1/2)
  let tenths = Math.floor((num * 2000 + den) / (2 * den));
  tenths = Math.min(999, Math.max(1, tenths));
  return `${Math.floor(tenths / 10)}.${tenths % 10}`;
}

// ---------- loading and joining ----------

interface RawFile { base?: string; runAt?: string; rows: Array<EvalRow & Record<string, unknown>> }

/**
 * Joins raw rows to their cases by id. Throws on: a duplicate id inside the run, a raw row with no case, a case with no raw row,
 * a label / kind / category / scam type that disagrees with the case file, or a row with neither a verdict nor an error.
 * The returned rows take label, category and scamType from the case file (older raw files do not carry them).
 */
export function joinRun(name: string, rawRows: RawFile["rows"], cases: Case[]): EvalRow[] {
  const byId = new Map(cases.map((c) => [c.id, c]));
  const seen = new Set<string>();
  const out: EvalRow[] = [];
  for (const r of rawRows) {
    const where = `run ${name}, row ${r.id}`;
    if (seen.has(r.id)) throw new Error(`${where}: duplicate id inside the run`);
    seen.add(r.id);
    const c = byId.get(r.id);
    if (!c) throw new Error(`${where}: no such case in the case file`);
    if (r.label !== c.label) throw new Error(`${where}: label ${String(r.label)} in the raw file but ${c.label} in the case file`);
    if (r.kind !== c.kind) throw new Error(`${where}: kind ${String(r.kind)} in the raw file but ${c.kind} in the case file`);
    if (r.category !== undefined && r.category !== c.category) throw new Error(`${where}: category mismatch (${String(r.category)} vs ${String(c.category)})`);
    if (r.scamType !== undefined && r.scamType !== c.scam_type) throw new Error(`${where}: scam type mismatch (${String(r.scamType)} vs ${String(c.scam_type)})`);
    if (!r.error && !r.verdict) throw new Error(`${where}: neither a verdict nor an error`);
    out.push({
      id: r.id, label: c.label, category: c.category, scamType: c.scam_type, kind: c.kind,
      verdict: r.verdict, predictedType: r.predictedType, latencyMs: r.latencyMs, error: r.error,
    });
  }
  const missing = cases.filter((c) => !seen.has(c.id)).map((c) => c.id);
  if (missing.length) throw new Error(`run ${name}: ${missing.length} cases have no result row (${missing.slice(0, 5).join(", ")}${missing.length > 5 ? ", ..." : ""}); a partial run cannot be official`);
  return out;
}

/** Reads the manifest and every raw file it lists (paths relative to the manifest). */
export function loadOfficialRuns(manifestPath = MANIFEST_PATH): RunData[] {
  const dir = dirname(manifestPath);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
  if (!Array.isArray(manifest.runs) || manifest.runs.length === 0) throw new Error(`${manifestPath}: no runs listed`);
  const names = new Set<string>();
  const raws = new Set<string>();
  return manifest.runs.map((m) => {
    if (names.has(m.name)) throw new Error(`${manifestPath}: duplicate run name ${m.name}`);
    names.add(m.name);
    if (raws.has(m.raw)) throw new Error(`${manifestPath}: ${m.raw} is listed twice`);
    raws.add(m.raw);
    const raw = JSON.parse(readFileSync(resolve(dir, m.raw), "utf8")) as RawFile;
    if (raw.runAt && raw.runAt !== m.runAt) throw new Error(`run ${m.name}: manifest runAt ${m.runAt} differs from the raw file's ${raw.runAt}`);
    return { name: m.name, runAt: m.runAt, base: raw.base ?? "", rows: joinRun(m.name, raw.rows, loadCases(resolve(dir, m.cases))) };
  });
}

// ---------- aggregation ----------

export interface Group { key: string; counts: Counts }
export interface Aggregate {
  runs: RunData[];
  rows: EvalRow[];
  overall: Counts;
  perRun: Group[];
  perCategory: Group[];
  perScamType: Group[];
  latency: Metrics["latency"];
  latencyAll: { p50: number; p95: number };
}

const CATEGORY_NONE = "original";

/** Combined metrics over all runs. Ids must be unique across runs: the same case twice would count twice, so it is rejected. */
export function aggregate(runs: RunData[]): Aggregate {
  const owner = new Map<string, string>();
  const rows: EvalRow[] = [];
  for (const run of runs) {
    for (const r of run.rows) {
      const prev = owner.get(r.id);
      if (prev !== undefined) throw new Error(`duplicate case id ${r.id} in runs ${prev} and ${run.name}: each case may appear in only one official run`);
      owner.set(r.id, run.name);
      rows.push(r);
    }
  }
  const groupBy = (key: (r: EvalRow) => string | undefined, order?: string[]): Group[] => {
    const m = new Map<string, EvalRow[]>();
    for (const r of rows) { const k = key(r); if (k !== undefined) (m.get(k) ?? m.set(k, []).get(k)!).push(r); }
    const keys = order ?? [...m.keys()].sort();
    return keys.filter((k) => m.has(k)).map((k) => ({ key: k, counts: countRows(m.get(k)!) }));
  };
  const lat = latencyStats(rows);
  const all = rows.filter((r) => r.latencyMs !== undefined && !r.error).map((r) => r.latencyMs!);
  return {
    runs, rows,
    overall: countRows(rows),
    perRun: runs.map((run) => ({ key: run.name, counts: countRows(run.rows) })),
    perCategory: groupBy((r) => (r.label === "ambiguous" ? "ambiguous" : (r.category ?? CATEGORY_NONE))),
    perScamType: groupBy((r) => (r.label === "scam" ? (r.scamType ?? "none") : undefined)),
    latency: lat,
    latencyAll: { p50: percentile(all, 50), p95: percentile(all, 95) },
  };
}

export function buildGenerated(agg: Aggregate): Generated {
  const c = agg.overall;
  return {
    accuracy: formatPct(c.correct, c.scored),
    recall: formatPct(c.scamsFlagged, c.scams),
    falsePositive: formatPct(c.legitFlagged, c.legitAnswered),
    cases: String(c.total),
    scams: String(c.scams),
    genuine: String(c.legit),
    ambiguous: String(c.ambiguous),
  };
}

// ---------- combined.md ----------

const secs = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
const pctCell = (num: number, den: number) => `${formatPct(num, den)}%`;
const VERDICT: Record<string, string> = { scam: "Scam", suspicious: "Suspicious", no_signs: "No scam signs found" };

export function renderCombined(agg: Aggregate): string {
  const c = agg.overall;
  const g = buildGenerated(agg);
  const runs = agg.runs;
  const latest = runs.map((r) => r.runAt).sort().at(-1)!;
  const bases = [...new Set(runs.map((r) => r.base).filter(Boolean))];
  const flaggedV = (r: EvalRow) => !r.error && isFlagged(r.verdict);
  const missed = agg.rows.filter((r) => r.label === "scam" && !flaggedV(r) && !r.error);
  const falsePos = agg.rows.filter((r) => r.label === "legit" && flaggedV(r));
  const errs = agg.rows.filter((r) => r.error);
  const amb = tally(agg.rows.filter((r) => r.label === "ambiguous"));
  const L: string[] = [];
  L.push("# Scam Shield evaluation: combined official runs", "");
  L.push(`Run: ${latest} (latest of ${runs.length} official runs: ${runs.map((r) => `${r.name} ${r.runAt.slice(0, 10)}`).join(", ")}) against ${bases.join(", ") || "the live app"} (language: en, concurrency: 1).`);
  L.push(`Cases: ${c.total} synthetic cases: ${c.scams} scams, ${c.legit} genuine, ${c.ambiguous} ambiguous. Ambiguous inputs are not scored as scam or genuine, so the metrics below use the ${c.scored} scam and genuine cases.`);
  L.push("A message counts as flagged when the verdict is Scam or Suspicious. A case that returned an error counts as wrong (a scam with an error is a miss).", "");
  L.push("| Metric | Result |", "|---|---|");
  L.push(`| Accuracy | ${pctCell(c.correct, c.scored)} |`);
  L.push(`| Scam recall (scams flagged) | ${pctCell(c.scamsFlagged, c.scams)} |`);
  L.push(`| False-positive rate (genuine flagged) | ${pctCell(c.legitFlagged, c.legitAnswered)} |`);
  L.push(`| Scam type correct (among flagged scams) | ${pctCell(c.typeHits, c.scamsFlagged)} |`);
  L.push(`| Errors | ${c.errors} |`, "");
  L.push("Rounding: percentages are computed from the exact counts below, rounded half up to one decimal. Exactly 0 and exactly 100 print without a decimal. A non-zero value never prints as 0 and a value below 100 never prints as 100, so a single miss or false positive always shows.", "");
  L.push("| Count | Value |", "|---|---|");
  L.push(`| Scored cases (scams + genuine) | ${c.scored} |`);
  L.push(`| Correct | ${c.correct} |`);
  L.push(`| Scams flagged / scams | ${c.scamsFlagged} / ${c.scams} |`);
  L.push(`| Genuine flagged / genuine answered | ${c.legitFlagged} / ${c.legitAnswered} |`);
  L.push(`| Flagged scams with the right type | ${c.typeHits} / ${c.scamsFlagged} |`);
  L.push(`| Ambiguous inputs given a Scam verdict (must be 0) | ${amb.ambiguousScam} / ${amb.ambiguous} |`);
  L.push(`| Ambiguous inputs: Suspicious / No scam signs | ${amb.ambiguousSuspicious} / ${amb.ambiguousNoSigns} |`);
  L.push("");
  L.push("| Input | p50 latency | p95 latency | Cases |", "|---|---|---|---|");
  for (const [k, v] of Object.entries(agg.latency)) L.push(`| ${k} | ${secs(v.p50)} | ${secs(v.p95)} | ${agg.rows.filter((r) => r.kind === k).length} |`);
  L.push(`| all successful calls | ${secs(agg.latencyAll.p50)} | ${secs(agg.latencyAll.p95)} | ${agg.rows.filter((r) => r.latencyMs !== undefined && !r.error).length} |`, "");
  L.push(`Missed scams: ${missed.length ? missed.map((r) => `${r.id} (${VERDICT[r.verdict ?? ""] ?? r.verdict})`).join(", ") : "none"}`);
  L.push(`False positives: ${falsePos.length ? falsePos.map((r) => `${r.id} (${VERDICT[r.verdict ?? ""] ?? r.verdict})`).join(", ") : "none"}`);
  L.push(`Ambiguous inputs given a Scam verdict: ${agg.rows.filter((r) => r.label === "ambiguous" && r.verdict === "scam").map((r) => r.id).join(", ") || "none"}`);
  L.push(`Errors: ${errs.map((r) => `${r.id} (${r.error})`).join(", ") || "none"}`, "");

  const row = (key: string, k: Counts) => `| ${key} | ${k.total} | ${k.scams} | ${k.legit} | ${k.ambiguous} | ${k.scored ? pctCell(k.correct, k.scored) : "n/a"} | ${k.scams ? pctCell(k.scamsFlagged, k.scams) : "n/a"} | ${k.legitAnswered ? pctCell(k.legitFlagged, k.legitAnswered) : "n/a"} | ${k.errors} |`;
  const head = (first: string) => [`| ${first} | Cases | Scams | Genuine | Ambiguous | Accuracy | Recall | False positives | Errors |`, "|---|---|---|---|---|---|---|---|---|"];
  L.push("## Per run", "", ...head("Run"));
  for (const r of runs) L.push(row(`${r.name} (${r.runAt.slice(0, 10)})`, countRows(r.rows)));
  L.push("");
  L.push("## Per category", "", "Category comes from the case file: the first 50 cases have none (shown as original); v2 uses adversarial and lookalike; v3 uses realistic_scam or the topic of the genuine message. Ambiguous inputs are grouped together.", "", ...head("Category"));
  for (const k of agg.perCategory) L.push(row(k.key, k.counts));
  L.push("");
  L.push("## Scam recall by scam type", "", "| Scam type | Scams | Flagged | Recall | Type correct |", "|---|---|---|---|---|");
  for (const k of agg.perScamType) L.push(`| ${k.key} | ${k.counts.scams} | ${k.counts.scamsFlagged} | ${pctCell(k.counts.scamsFlagged, k.counts.scams)} | ${k.counts.scamsFlagged ? pctCell(k.counts.typeHits, k.counts.scamsFlagged) : "n/a"} |`);
  L.push("");
  L.push("Official runs are listed in `eval/results/official.json`; raw results are `eval/results/*.raw.json`. This file and `web/src/benchmark.generated.json` are written by `npx tsx eval/aggregate.ts` and checked by `web/src/benchmark.test.ts`, so the landing page cannot drift from the evidence.");
  L.push(`Landing page values: accuracy ${g.accuracy}, recall ${g.recall}, false-positive rate ${g.falsePositive}, ${g.cases} cases.`, "");
  return L.join("\n");
}

export function renderGeneratedJson(g: Generated): string {
  return JSON.stringify(g, null, 2) + "\n";
}

// ---------- CLI ----------

function main(): void {
  const check = process.argv.includes("--check");
  const agg = aggregate(loadOfficialRuns());
  const md = renderCombined(agg);
  const json = renderGeneratedJson(buildGenerated(agg));
  if (check) {
    const stale = ([[COMBINED_MD_PATH, md], [GENERATED_JSON_PATH, json]] as const).filter(([p, want]) => !existsSync(p) || readFileSync(p, "utf8") !== want).map(([p]) => p);
    if (stale.length) { console.error(`out of date: ${stale.join(", ")}\nrun: npx tsx eval/aggregate.ts`); process.exit(1); }
    console.log("combined.md and benchmark.generated.json are up to date");
    return;
  }
  writeFileSync(COMBINED_MD_PATH, md);
  writeFileSync(GENERATED_JSON_PATH, json);
  console.log(json);
  console.log(`wrote ${COMBINED_MD_PATH} and ${GENERATED_JSON_PATH}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
