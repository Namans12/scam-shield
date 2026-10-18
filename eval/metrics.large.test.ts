// Large-data tests for eval/metrics.ts: 10,000 and 100,000 synthetic rows with exact, by-construction ground truth,
// shuffled with a seeded PRNG, compared to an independent brute-force reference (reference-metrics.ts). No network.
import { describe, expect, it } from "vitest";
import { computeMetrics, countRows, latencyStats, percentile, tally, type EvalRow } from "./metrics";
import { buildDataset, expectedPercentile, mulberry32, shuffle, type Plan } from "./synth";
import { refCounts, refLatency, refPercentile } from "./reference-metrics";

const r3 = (x: number) => Math.round(x * 1000) / 1000;
const ratio = (a: number, b: number) => (b === 0 ? 0 : r3(a / b));

// Plans: exact counts chosen by hand so the expected numbers are known without running any metrics code.
const PLANS: Array<{ name: string; plan: Plan }> = [
  { name: "10k, mixed outcomes", plan: { seed: 1, scamsCaught: 4421, typeWrong: 313, scamsMissed: 187, scamsErrors: 42, legitFlagged: 233, legitCleared: 4318, legitErrors: 29, ambScam: 31, ambSuspicious: 110, ambNoSigns: 280, ambErrors: 6 } },
  { name: "10k, one miss and one false positive", plan: { seed: 2, scamsCaught: 4999, scamsMissed: 1, legitFlagged: 1, legitCleared: 4999 } },
  { name: "10k, perfect", plan: { seed: 3, scamsCaught: 5000, legitCleared: 5000 } },
  { name: "100k, mixed outcomes", plan: { seed: 4, scamsCaught: 44_217, typeWrong: 2_731, scamsMissed: 1_903, scamsErrors: 410, legitFlagged: 2_388, legitCleared: 48_112, legitErrors: 290, ambScam: 120, ambSuspicious: 901, ambNoSigns: 1_450, ambErrors: 79 } },
  { name: "100k, 99.96 percent recall regime", plan: { seed: 5, scamsCaught: 49_980, scamsMissed: 20, legitFlagged: 4, legitCleared: 49_996 } },
];

describe.each(PLANS)("$name", ({ plan }) => {
  const { rows, expected } = buildDataset(plan);

  it("builds the planned number of rows", () => {
    expect(rows).toHaveLength(expected.total);
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
  });

  it("countRows equals the by-construction counts exactly", () => {
    const { successfulByKind: _ignored, ...want } = expected;
    expect(countRows(rows)).toEqual(want);
  });

  it("countRows equals the brute-force reference", () => {
    expect(countRows(rows)).toEqual(refCounts(rows));
  });

  it("accuracy, recall, false-positive rate and type accuracy match the by-construction values", () => {
    const m = computeMetrics(rows);
    expect(m.n).toBe(expected.scored);
    expect(m.errors).toBe(expected.errors);
    expect(m.accuracy).toBe(ratio(expected.correct, expected.scored));
    expect(m.scamRecall).toBe(ratio(expected.scamsFlagged, expected.scams));
    expect(m.falsePositiveRate).toBe(ratio(expected.legitFlagged, expected.legitAnswered));
    expect(m.typeAccuracy).toBe(ratio(expected.typeHits, expected.scamsFlagged));
  });

  it("computeMetrics matches the brute-force reference, latency included", () => {
    const m = computeMetrics(rows);
    const ref = refCounts(rows);
    expect(m.accuracy).toBe(ratio(ref.correct, ref.scored));
    expect(m.scamRecall).toBe(ratio(ref.scamsFlagged, ref.scams));
    expect(m.falsePositiveRate).toBe(ratio(ref.legitFlagged, ref.legitAnswered));
    expect(m.typeAccuracy).toBe(ratio(ref.typeHits, ref.scamsFlagged));
    const refLat = refLatency(rows, true);
    expect(Object.keys(m.latency).sort()).toEqual(Object.keys(refLat).sort());
    for (const [k, v] of Object.entries(refLat)) {
      expect(m.latency[k]!.p50).toBeCloseTo(v.p50, 2);
      expect(m.latency[k]!.p95).toBeCloseTo(v.p95, 2);
    }
  });

  it("p50 and p95 over all successful calls match the closed form and the reference; failed calls never count", () => {
    const lat = latencyStats(rows);
    const refLat = refLatency(rows, false);
    for (const [kind, n] of Object.entries(expected.successfulByKind)) {
      expect(lat[kind]!.p50).toBeCloseTo(expectedPercentile(n, 50), 2);
      expect(lat[kind]!.p95).toBeCloseTo(expectedPercentile(n, 95), 2);
      expect(lat[kind]!.p50).toBeCloseTo(refLat[kind]!.p50, 2);
      expect(lat[kind]!.p95).toBeCloseTo(refLat[kind]!.p95, 2);
      expect(lat[kind]!.p95).toBeLessThan(999_999);
    }
  });

  it("percentile() agrees with the reference on the full latency list", () => {
    const all = rows.filter((r) => !r.error).map((r) => r.latencyMs!);
    for (const p of [0, 1, 25, 50, 75, 90, 95, 99, 100]) expect(percentile(all, p)).toBeCloseTo(refPercentile(all, p), 6);
  });

  it("three-class tally agrees with the construction", () => {
    const t = tally(rows);
    expect(t.n).toBe(expected.total);
    expect(t.scams).toBe(expected.scams);
    expect(t.scamsFlagged).toBe(expected.scamsFlagged);
    expect(t.legit).toBe(expected.legit);
    expect(t.legitFlagged).toBe(expected.legitFlagged);
    expect(t.ambiguous).toBe(expected.ambiguous);
    expect(t.ambiguousScam + t.ambiguousSuspicious + t.ambiguousNoSigns).toBe(expected.ambiguous - (plan.ambErrors ?? 0));
  });

  it("is independent of row order", () => {
    const base = computeMetrics(rows);
    const baseCounts = countRows(rows);
    const baseLat = latencyStats(rows);
    for (const seed of [11, 12, 13]) {
      const copy = shuffle(rows.slice(), mulberry32(seed));
      expect(countRows(copy)).toEqual(baseCounts);
      expect(computeMetrics(copy)).toEqual(base);
      expect(latencyStats(copy)).toEqual(baseLat);
    }
  });

  it("merging three chunks equals computing on the whole set (counts add up)", () => {
    const a = rows.slice(0, Math.floor(rows.length / 3));
    const b = rows.slice(a.length, 2 * a.length + 17);
    const c = rows.slice(a.length + b.length);
    const sum = (k: keyof ReturnType<typeof countRows>) => countRows(a)[k] + countRows(b)[k] + countRows(c)[k];
    const whole = countRows(rows);
    for (const k of Object.keys(whole) as Array<keyof typeof whole>) expect(sum(k)).toBe(whole[k]);
    expect(countRows([...c, ...a, ...b])).toEqual(whole);
  });
});

describe("edge sets", () => {
  it("empty set gives zeros and does not divide by zero", () => {
    expect(computeMetrics([])).toEqual({ n: 0, accuracy: 0, scamRecall: 0, falsePositiveRate: 0, typeAccuracy: 0, latency: {}, errors: 0 });
    expect(countRows([])).toEqual({ total: 0, scams: 0, legit: 0, ambiguous: 0, scored: 0, errors: 0, correct: 0, scamsFlagged: 0, legitFlagged: 0, legitAnswered: 0, typeHits: 0 });
    expect(latencyStats([])).toEqual({});
    expect(percentile([], 95)).toBe(0);
  });

  it("all rows errors: accuracy 0, recall 0 (errors are misses), false-positive rate 0 (nothing flagged), no latency", () => {
    const { rows } = buildDataset({ seed: 21, scamsCaught: 0, scamsMissed: 0, scamsErrors: 3_000, legitFlagged: 0, legitCleared: 0, legitErrors: 2_000 });
    const m = computeMetrics(rows);
    expect(m).toMatchObject({ n: 5_000, accuracy: 0, scamRecall: 0, falsePositiveRate: 0, typeAccuracy: 0, errors: 5_000, latency: {} });
    expect(countRows(rows)).toMatchObject({ scored: 5_000, errors: 5_000, correct: 0, legitAnswered: 0 });
  });

  it("all rows ambiguous: nothing is scored, everything is counted", () => {
    const { rows } = buildDataset({ seed: 22, scamsCaught: 0, scamsMissed: 0, legitFlagged: 0, legitCleared: 0, ambScam: 100, ambSuspicious: 200, ambNoSigns: 300, ambErrors: 5 });
    const m = computeMetrics(rows);
    expect(m).toMatchObject({ n: 0, accuracy: 0, scamRecall: 0, falsePositiveRate: 0, errors: 0 });
    expect(countRows(rows)).toMatchObject({ total: 605, ambiguous: 605, scored: 0, scams: 0, legit: 0 });
    expect(Object.keys(latencyStats(rows)).length).toBeGreaterThan(0); // ambiguous calls still count towards latency
    expect(Object.keys(m.latency)).toEqual([]);
  });

  it("a row with an error is treated as having no verdict, even if a verdict is attached", () => {
    const rows: EvalRow[] = [
      { id: "a", label: "scam", scamType: "kyc_update", kind: "text", verdict: "scam", predictedType: "kyc_update", error: "502" },
      { id: "b", label: "legit", kind: "text", verdict: "scam", predictedType: "kyc_update", error: "502" },
    ];
    expect(countRows(rows)).toMatchObject({ scamsFlagged: 0, legitFlagged: 0, correct: 0, errors: 2, legitAnswered: 0 });
  });

  it("suspicious counts as flagged, no_signs and a missing verdict do not", () => {
    const rows: EvalRow[] = [
      { id: "1", label: "scam", scamType: "job_task", kind: "text", verdict: "suspicious", predictedType: "job_task" },
      { id: "2", label: "scam", scamType: "job_task", kind: "text", verdict: "no_signs" },
      { id: "3", label: "scam", scamType: "job_task", kind: "text" },
    ];
    expect(countRows(rows)).toMatchObject({ scamsFlagged: 1, correct: 1, typeHits: 1 });
  });
});
