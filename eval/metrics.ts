import type { ScamType, Verdict } from "@scam-shield/shared";

export type Label = "scam" | "legit" | "ambiguous";

export interface EvalRow {
  id: string;
  label: Label;
  /** adversarial | lookalike | ambiguous in cases-v2.jsonl; absent in v1. */
  category?: string;
  scamType?: ScamType;
  kind: string;
  verdict?: Verdict;
  predictedType?: ScamType;
  latencyMs?: number;
  error?: string;
}

export interface Metrics {
  n: number;
  accuracy: number;
  scamRecall: number;
  falsePositiveRate: number;
  typeAccuracy: number;
  latency: Record<string, { p50: number; p95: number }>;
  errors: number;
}

const r3 = (x: number) => Math.round(x * 1000) / 1000;
const ratio = (a: number, b: number) => (b === 0 ? 0 : r3(a / b));

/** Linear-interpolated percentile of an unsorted list (p in 0..100). */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const v = [...values].sort((a, b) => a - b);
  const idx = (p / 100) * (v.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return v[lo]! + (v[hi]! - v[lo]!) * (idx - lo);
}

/**
 * "Flagged" means the verdict is scam or suspicious. A row with an error counts as wrong for accuracy and as a
 * miss for recall (conservative), and is left out of the false-positive rate (it flagged nothing).
 * typeAccuracy = share of flagged scams whose predicted type equals the labelled type.
 */
export function computeMetrics(allRows: EvalRow[]): Metrics {
  const rows = allRows.filter((r) => r.label !== "ambiguous"); // ambiguous cases are scored by tally(), not by these two-class metrics
  const flagged = (r: EvalRow) => r.verdict === "scam" || r.verdict === "suspicious";
  const scams = rows.filter((r) => r.label === "scam");
  const legit = rows.filter((r) => r.label === "legit");
  const correct = rows.filter((r) => !r.error && (r.label === "scam" ? flagged(r) : !flagged(r))).length;
  const flaggedScams = scams.filter(flagged);
  const typeHits = flaggedScams.filter((r) => r.predictedType === r.scamType).length;

  const byKind: Record<string, number[]> = {};
  for (const r of rows) if (r.latencyMs !== undefined && !r.error) (byKind[r.kind] ??= []).push(r.latencyMs);
  const latency: Metrics["latency"] = {};
  for (const [k, v] of Object.entries(byKind)) latency[k] = { p50: r3(percentile(v, 50)), p95: r3(percentile(v, 95)) };

  return {
    n: rows.length,
    accuracy: ratio(correct, rows.length),
    scamRecall: ratio(flaggedScams.length, scams.length),
    falsePositiveRate: ratio(legit.filter(flagged).length, legit.filter((r) => !r.error).length),
    typeAccuracy: ratio(typeHits, flaggedScams.length),
    latency,
    errors: rows.filter((r) => r.error).length,
  };
}

// ---- three-class scoring used by eval v2 (scam / legit / ambiguous) ----

export const isFlagged = (v?: string) => v === "scam" || v === "suspicious";

/**
 * pass: scam flagged (Scam or Suspicious); legit not flagged; ambiguous anything except a Scam verdict
 * ("No scam signs found" and "Suspicious" are both acceptable there). A row with an error never passes.
 */
export function passed(r: Pick<EvalRow, "label" | "verdict" | "error">): boolean {
  if (r.error || !r.verdict) return false;
  if (r.label === "scam") return isFlagged(r.verdict);
  if (r.label === "legit") return !isFlagged(r.verdict);
  return r.verdict !== "scam";
}

export interface Tally {
  n: number;
  errors: number;
  passed: number;
  accuracy: number;
  scams: number;
  scamsFlagged: number;
  /** Scam verdict only (Suspicious not counted). */
  scamsStrict: number;
  scamRecall: number;
  legit: number;
  legitFlagged: number;
  falsePositiveRate: number;
  ambiguous: number;
  ambiguousScam: number;
  ambiguousSuspicious: number;
  ambiguousNoSigns: number;
}

export function tally(rows: Array<Pick<EvalRow, "label" | "verdict" | "error">>): Tally {
  const scams = rows.filter((r) => r.label === "scam");
  const legit = rows.filter((r) => r.label === "legit");
  const amb = rows.filter((r) => r.label === "ambiguous");
  const ok = (r: { error?: string; verdict?: string }) => !r.error && !!r.verdict;
  const scamsFlagged = scams.filter((r) => ok(r) && isFlagged(r.verdict)).length;
  const legitFlagged = legit.filter((r) => ok(r) && isFlagged(r.verdict)).length;
  const nPassed = rows.filter(passed).length;
  return {
    n: rows.length,
    errors: rows.filter((r) => r.error).length,
    passed: nPassed,
    accuracy: ratio(nPassed, rows.length),
    scams: scams.length,
    scamsFlagged,
    scamsStrict: scams.filter((r) => ok(r) && r.verdict === "scam").length,
    scamRecall: ratio(scamsFlagged, scams.length),
    legit: legit.length,
    legitFlagged,
    falsePositiveRate: ratio(legitFlagged, legit.filter(ok).length),
    ambiguous: amb.length,
    ambiguousScam: amb.filter((r) => ok(r) && r.verdict === "scam").length,
    ambiguousSuspicious: amb.filter((r) => ok(r) && r.verdict === "suspicious").length,
    ambiguousNoSigns: amb.filter((r) => ok(r) && r.verdict === "no_signs").length,
  };
}
