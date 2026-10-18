// Test support: an INDEPENDENT, deliberately naive reference for the benchmark metrics (plain loops, no use of metrics.ts or
// aggregate.ts). The large tests compare the real code to this and to the by-construction numbers in synth.ts.
import type { EvalRow } from "./metrics";

export interface RefCounts {
  total: number; scams: number; legit: number; ambiguous: number; scored: number; errors: number; correct: number;
  scamsFlagged: number; legitFlagged: number; legitAnswered: number; typeHits: number;
}

export function refCounts(rows: EvalRow[]): RefCounts {
  const c: RefCounts = { total: 0, scams: 0, legit: 0, ambiguous: 0, scored: 0, errors: 0, correct: 0, scamsFlagged: 0, legitFlagged: 0, legitAnswered: 0, typeHits: 0 };
  for (const r of rows) {
    c.total++;
    const failed = r.error !== undefined && r.error !== "";
    const flagged = !failed && (r.verdict === "scam" || r.verdict === "suspicious");
    if (r.label === "ambiguous") { c.ambiguous++; continue; }
    c.scored++;
    if (failed) c.errors++;
    if (r.label === "scam") {
      c.scams++;
      if (flagged) { c.scamsFlagged++; c.correct++; if (r.predictedType === r.scamType) c.typeHits++; }
    } else {
      c.legit++;
      if (!failed) c.legitAnswered++;
      if (flagged) c.legitFlagged++;
      else if (!failed) c.correct++;
    }
  }
  return c;
}

/** Percentile by the textbook definition (rank = p/100 * (n-1), linear interpolation between neighbours). */
export function refPercentile(values: number[], p: number): number {
  const n = values.length;
  if (n === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const rank = (p * (n - 1)) / 100;
  const lo = Math.floor(rank);
  const frac = rank - lo;
  return lo + 1 < n ? sorted[lo]! * (1 - frac) + sorted[lo + 1]! * frac : sorted[n - 1]!;
}

/** Latency by kind over the given rows (two-class rows only when `scoredOnly`), successful calls only. */
export function refLatency(rows: EvalRow[], scoredOnly: boolean): Record<string, { p50: number; p95: number }> {
  const by: Record<string, number[]> = {};
  for (const r of rows) {
    if (scoredOnly && r.label === "ambiguous") continue;
    if (r.error || r.latencyMs === undefined) continue;
    (by[r.kind] ??= []).push(r.latencyMs);
  }
  const out: Record<string, { p50: number; p95: number }> = {};
  for (const k of Object.keys(by)) out[k] = { p50: refPercentile(by[k]!, 50), p95: refPercentile(by[k]!, 95) };
  return out;
}

/** Percentage to one decimal, exact: round half up using only integer long division on the counts. */
export function refPctString(num: number, den: number): string {
  if (den === 0 || num === 0) return "0";
  if (num === den) return "100";
  const tenthsFloor = Math.floor((num * 1000) / den);
  const rem = num * 1000 - tenthsFloor * den;
  let t = rem * 2 >= den ? tenthsFloor + 1 : tenthsFloor;
  if (t >= 1000) t = 999;
  if (t < 1) t = 1;
  return `${Math.floor(t / 10)}.${t % 10}`;
}
