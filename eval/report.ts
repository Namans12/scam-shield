// Renders the eval v2 report (Gemini vs keyword baseline) as markdown. Pure: no network, no file access.
import { classify } from "./baseline";
import type { Case } from "./cases";
import { passed, percentile, tally, type EvalRow, type Tally } from "./metrics";

export interface LiveRow extends EvalRow {
  riskScore?: number;
  summary?: string;
  redFlags?: string[];
  hardSignals?: string[];
  hits?: Array<{ key: string; reportCount: number }>;
  entityKeys?: string[];
  attempts: number;
  /** One entry per retried transient error, e.g. "502 analysis_failed". */
  retried?: string[];
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const frac = (a: number, b: number) => `${a}/${b}`;
const VERDICT: Record<string, string> = { scam: "Scam", suspicious: "Suspicious", no_signs: "No scam signs found" };
const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

function baselineRows(cases: Case[]): EvalRow[] {
  return cases.filter((c) => c.kind === "text" && c.text).map((c) => ({
    id: c.id, label: c.label, category: c.category, scamType: c.scam_type, kind: c.kind, verdict: classify(c.text!).verdict,
  }));
}

function tableFor(name: string, g: Tally, b: Tally, hasAmb: boolean): string[] {
  const lines = [
    `| ${name} | Gemini (live API) | Keyword baseline |`,
    "|---|---|---|",
    `| Cases scored | ${g.n} | ${b.n} |`,
    `| Accuracy | ${pct(g.accuracy)} (${frac(g.passed, g.n)}) | ${pct(b.accuracy)} (${frac(b.passed, b.n)}) |`,
    `| Scam recall (Scam or Suspicious) | ${pct(g.scamRecall)} (${frac(g.scamsFlagged, g.scams)}) | ${pct(b.scamRecall)} (${frac(b.scamsFlagged, b.scams)}) |`,
    `| Scam recall, strict (Scam verdict only) | ${frac(g.scamsStrict, g.scams)} | ${frac(b.scamsStrict, b.scams)} |`,
    `| False-positive rate (genuine flagged) | ${pct(g.falsePositiveRate)} (${frac(g.legitFlagged, g.legit)}) | ${pct(b.falsePositiveRate)} (${frac(b.legitFlagged, b.legit)}) |`,
  ];
  if (hasAmb) lines.push(`| Ambiguous inputs given a Scam verdict (must be 0) | ${frac(g.ambiguousScam, g.ambiguous)} | ${frac(b.ambiguousScam, b.ambiguous)} |`,
    `| Ambiguous inputs: Suspicious / No scam signs | ${g.ambiguousSuspicious} / ${g.ambiguousNoSigns} | ${b.ambiguousSuspicious} / ${b.ambiguousNoSigns} |`);
  return lines;
}

export interface ReportInput {
  rows: LiveRow[];
  cases: Case[];
  /** Cases of the earlier v1 file, for the baseline-only v1 line. */
  v1Cases: Case[];
  base: string;
  lang: string;
  gapMs: number;
  runAt: string;
  liveCalls: number;
  casesFile: string;
  /** Name of the run (results/<outName>.md and .raw.json); default "run-v2". */
  outName?: string;
}

export function renderReport(i: ReportInput): string {
  const { rows, cases } = i;
  const byId = new Map(cases.map((c) => [c.id, c]));
  const textRows = rows.filter((r) => r.kind === "text");
  const bAll = baselineRows(cases);
  const bTally = tally(bAll);
  const gTextTally = tally(textRows);
  const gAll = tally(rows);
  const bOf = (id: string) => bAll.find((r) => r.id === id)?.verdict;

  // v2 files carry the adversarial / lookalike / ambiguous categories; any other file (v3) is a plain mix of scams and genuine messages.
  const v2Style = rows.some((r) => r.category === "adversarial" || r.category === "lookalike");
  const nOf = (label: string) => rows.filter((r) => r.label === label).length;
  const out: string[] = [];
  out.push(v2Style ? "# Scam Shield evaluation v2: adversarial and look-alike cases" : `# Scam Shield evaluation ${i.casesFile.replace(/^cases-|\.jsonl$/g, "")}: realistic scams and genuine messages`, "");
  out.push(v2Style
    ? `Run: ${i.runAt} against ${i.base} (language: ${i.lang}). ${rows.length} new cases from \`eval/${i.casesFile}\`: ${nOf("scam")} adversarial scams, ${nOf("legit")} benign look-alikes, ${nOf("ambiguous")} ambiguous or garbage inputs.`
    : `Run: ${i.runAt} against ${i.base} (language: ${i.lang}). ${rows.length} new cases from \`eval/${i.casesFile}\`: ${nOf("scam")} scams, ${nOf("legit")} genuine messages${nOf("ambiguous") ? `, ${nOf("ambiguous")} ambiguous inputs` : ""}.`);
  out.push(`One case at a time, ${(i.gapMs / 1000).toFixed(1)} s apart, ${i.liveCalls} live API calls in this run (including retries). Nothing was tuned after seeing these results.`);
  out.push("Flagged means the verdict is Scam or Suspicious. For ambiguous inputs, \"No scam signs found\" and \"Suspicious\" both pass; only a Scam verdict fails. No case is labelled \"safe\", because no tool can certify that.", "");

  out.push("## Gemini against the keyword baseline, same cases", "");
  out.push("The baseline (`eval/baseline.ts`) is a rule-based detector with about 30 patterns (OTP and KYC asks, blocked/urgent words, risky links, lottery, digital arrest, UPI collect/QR, fees, secrecy) and handles \"do not share your OTP\" negation. It reads text only, so the one image case is left out of this table.", "");
  out.push(...tableFor(`All text cases (${textRows.length})`, gTextTally, bTally, true), "");
  if (rows.length !== textRows.length) out.push(`Gemini on all ${rows.length} cases including the image: accuracy ${pct(gAll.accuracy)} (${frac(gAll.passed, gAll.n)}).`, "");

  out.push("### By category", "");
  out.push("| Category | Gemini | Keyword baseline |", "|---|---|---|");
  const catLine = (cat: string, gr: EvalRow[], br: EvalRow[]) => {
    const g = tally(gr), b = tally(br);
    const f = (t: Tally) => cat === "adversarial" ? `${frac(t.scamsFlagged, t.scams)} flagged (${frac(t.scamsStrict, t.scams)} as Scam)`
      : cat === "lookalike" ? `${frac(t.legit - t.legitFlagged, t.legit)} correctly not flagged (false-positive rate ${pct(t.falsePositiveRate)})`
        : `${frac(t.ambiguous - t.ambiguousScam, t.ambiguous)} not given a Scam verdict (${t.ambiguousSuspicious} Suspicious)`;
    return `| ${cat} (${gr.length} cases${br.length !== gr.length ? `; ${br.length} text` : ""}) | ${f(g)} | ${f(b)} |`;
  };
  if (v2Style) {
    for (const cat of ["adversarial", "lookalike", "ambiguous"]) {
      out.push(catLine(cat, rows.filter((r) => r.category === cat), bAll.filter((r) => r.category === cat)));
    }
  } else {
    const cats = [...new Set(rows.map((r) => r.category ?? "none"))];
    for (const cat of cats) {
      const gr = rows.filter((r) => (r.category ?? "none") === cat), br = bAll.filter((r) => (r.category ?? "none") === cat);
      const f = (rs: EvalRow[]) => { const t = tally(rs); return t.scams ? `${frac(t.scamsFlagged, t.scams)} flagged (${frac(t.scamsStrict, t.scams)} as Scam)` : `${frac(t.legit - t.legitFlagged, t.legit)} correctly not flagged`; };
      out.push(`| ${cat} (${gr.length} cases${br.length !== gr.length ? `; ${br.length} text` : ""}) | ${f(gr)} | ${f(br)} |`);
    }
    out.push("", "### Scam recall by scam type", "", "| Scam type | Gemini flagged | Keyword baseline flagged |", "|---|---|---|");
    for (const t of [...new Set(rows.filter((r) => r.label === "scam").map((r) => r.scamType ?? "none"))]) {
      const gs = tally(rows.filter((r) => r.label === "scam" && (r.scamType ?? "none") === t)), bs = tally(bAll.filter((r) => r.label === "scam" && (r.scamType ?? "none") === t));
      out.push(`| ${t} | ${frac(gs.scamsFlagged, gs.scams)} | ${frac(bs.scamsFlagged, bs.scams)} |`);
    }
  }
  out.push("");

  out.push("### Baseline on the original 50 cases", "");
  const v1Text = i.v1Cases.filter((c) => c.kind === "text");
  const bv1 = tally(baselineRows(i.v1Cases));
  out.push(`The keyword baseline scored ${pct(bv1.accuracy)} accuracy, ${pct(bv1.scamRecall)} recall and ${pct(bv1.falsePositiveRate)} false positives on the ${v1Text.length} text cases of \`cases.jsonl\` (its rules were tuned on those). Gemini scored 100% on the same set in the 17 Oct run (\`results/latest.md\`). A simple keyword filter already does well on textbook scams, so the original set could not show what the model adds; the cases above are where the two can differ.`, "");

  const lat = textRows.filter((r) => r.latencyMs !== undefined && !r.error).map((r) => r.latencyMs!);
  const allLat = rows.filter((r) => r.latencyMs !== undefined && !r.error).map((r) => r.latencyMs!);
  out.push("## Latency, errors, retries", "");
  out.push(`- Latency (all successful calls): p50 ${(percentile(allLat, 50) / 1000).toFixed(1)} s, p95 ${(percentile(allLat, 95) / 1000).toFixed(1)} s; text only: p50 ${(percentile(lat, 50) / 1000).toFixed(1)} s, p95 ${(percentile(lat, 95) / 1000).toFixed(1)} s.`);
  const retried = rows.filter((r) => r.retried?.length);
  out.push(`- Errors after retries: ${rows.filter((r) => r.error).map((r) => `${r.id} (${r.error})`).join(", ") || "none"}.`);
  out.push(`- Transient errors retried (once each, only for 429 rate_limited, 502, 503, 504): ${retried.length ? retried.map((r) => `${r.id} (${r.retried!.join(", ")})`).join(", ") : "none"}.`, "");

  const fails = rows.filter((r) => !passed(r));
  out.push("## Every miss, false positive and failure", "");
  if (!fails.length) out.push("None: every case passed.", "");
  for (const r of fails) {
    const c = byId.get(r.id)!;
    const kind = r.error ? "ERROR" : r.label === "scam" ? "MISSED SCAM" : r.label === "legit" ? "FALSE POSITIVE" : "AMBIGUOUS GIVEN A SCAM VERDICT";
    out.push(`### ${r.id} (${r.category}): ${kind}`, "");
    out.push(`- Message${c.kind !== "text" ? ` (${c.kind}, ${c.asset})` : ""}: ${JSON.stringify(c.text)}`);
    out.push(`- Trick: ${c.tactic}`);
    out.push(`- Gemini: ${r.error ? `error ${r.error}` : `${VERDICT[r.verdict!]}, risk ${r.riskScore}, type ${r.predictedType}`}${r.summary ? `. It said: "${r.summary}"` : ""}`);
    if (r.redFlags?.length) out.push(`- Red flags raised: ${r.redFlags.join("; ")}`);
    out.push(`- Baseline: ${bOf(r.id) ? VERDICT[bOf(r.id)!] : "not applicable"}`, "");
  }
  const bFails = bAll.filter((r) => !passed(r) && rows.find((g) => g.id === r.id && passed(g)));
  if (bFails.length) {
    out.push("### Where the baseline failed and Gemini did not", "");
    for (const r of bFails) out.push(`- ${r.id} (${r.category}, ${r.label}): baseline said ${VERDICT[r.verdict!]}; message ${JSON.stringify(byId.get(r.id)!.text)}`);
    out.push("");
  }

  out.push("## Scam-list hard signals", "");
  const hs = rows.filter((r) => r.hardSignals?.length || r.hits?.length);
  out.push(hs.length
    ? "Rows where the API reported a scam-list hit or a hard signal (these can only raise a verdict):\n\n" + hs.map((r) => `- ${r.id}: hardSignals [${(r.hardSignals ?? []).join(", ")}], list hits [${(r.hits ?? []).map((h) => `${h.key} x${h.reportCount}`).join(", ")}]`).join("\n")
    : "No case triggered a scam-list hit or hard signal, so none of these verdicts was list-assisted (`hardSignals` was empty on every row).", "");

  out.push("## All cases", "");
  out.push("| id | category | expected | Gemini | risk | type | baseline | result |", "|---|---|---|---|---|---|---|---|");
  for (const r of rows) {
    const b = bOf(r.id);
    out.push(`| ${r.id} | ${r.category} | ${cell(byId.get(r.id)!.expect ?? r.label)} | ${r.error ? `error ${cell(r.error)}` : VERDICT[r.verdict!]} | ${r.riskScore ?? ""} | ${r.predictedType ?? ""} | ${b ? `${VERDICT[b]}${passed({ label: r.label, verdict: b }) ? "" : " (wrong)"}` : "n/a"} | ${passed(r) ? "pass" : "FAIL"} |`);
  }
  out.push("", `Cases: \`eval/${i.casesFile}\`. Raw results with per-row verdicts, summaries, hard signals and retry log: \`eval/results/${i.outName ?? "run-v2"}.raw.json\`.`, "");
  return out.join("\n");
}
