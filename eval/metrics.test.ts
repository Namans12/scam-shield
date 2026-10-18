import { describe, expect, it } from "vitest";
import { computeMetrics, percentile, type EvalRow } from "./metrics";

const rows: EvalRow[] = [
  { id: "a", label: "scam", scamType: "kyc_update", kind: "text", verdict: "scam", predictedType: "kyc_update", latencyMs: 1000 },
  { id: "b", label: "scam", scamType: "kyc_update", kind: "text", verdict: "no_signs", predictedType: "none", latencyMs: 2000 },
  { id: "c", label: "legit", kind: "text", verdict: "suspicious", predictedType: "other", latencyMs: 3000 },
  { id: "d", label: "legit", kind: "text", verdict: "no_signs", predictedType: "none", latencyMs: 4000 },
];

describe("computeMetrics", () => {
  it("computes accuracy, recall, false-positive rate, type accuracy and latency", () => {
    expect(computeMetrics(rows)).toEqual({
      n: 4,
      accuracy: 0.5,
      scamRecall: 0.5,
      falsePositiveRate: 0.5,
      typeAccuracy: 1,
      latency: { text: { p50: 2500, p95: 3850 } },
      errors: 0,
    });
  });

  it("counts suspicious as flagged and wrong-type scams against typeAccuracy", () => {
    const m = computeMetrics([
      { id: "a", label: "scam", scamType: "job_task", kind: "text", verdict: "suspicious", predictedType: "investment", latencyMs: 10 },
      { id: "b", label: "scam", scamType: "job_task", kind: "text", verdict: "scam", predictedType: "job_task", latencyMs: 20 },
    ]);
    expect(m.scamRecall).toBe(1);
    expect(m.typeAccuracy).toBe(0.5);
  });

  it("treats an error as wrong and as a miss, but not as a false positive, and ignores its latency", () => {
    const m = computeMetrics([
      { id: "a", label: "scam", scamType: "kyc_update", kind: "image", error: "boom", latencyMs: 99 },
      { id: "b", label: "legit", kind: "image", error: "boom" },
      { id: "c", label: "legit", kind: "image", verdict: "no_signs", latencyMs: 40 },
    ]);
    expect(m).toMatchObject({ n: 3, accuracy: 0.333, scamRecall: 0, falsePositiveRate: 0, errors: 2 });
    expect(m.latency).toEqual({ image: { p50: 40, p95: 40 } });
  });

  it("handles an empty run", () => {
    expect(computeMetrics([])).toMatchObject({ n: 0, accuracy: 0, scamRecall: 0, falsePositiveRate: 0 });
  });
});

describe("percentile", () => {
  it("interpolates linearly", () => {
    expect(percentile([1, 2, 3, 4], 50)).toBe(2.5);
    expect(percentile([5], 95)).toBe(5);
    expect(percentile([], 50)).toBe(0);
  });
});

import { passed, tally } from "./metrics";

describe("three-class scoring (v2)", () => {
  it("passes ambiguous inputs unless the verdict is Scam", () => {
    expect(passed({ label: "ambiguous", verdict: "no_signs" })).toBe(true);
    expect(passed({ label: "ambiguous", verdict: "suspicious" })).toBe(true);
    expect(passed({ label: "ambiguous", verdict: "scam" })).toBe(false);
    expect(passed({ label: "ambiguous", error: "502 analysis_failed" })).toBe(false);
  });
  it("tallies scams, genuine and ambiguous rows separately", () => {
    const t = tally([
      { label: "scam", verdict: "scam" },
      { label: "scam", verdict: "suspicious" },
      { label: "scam", verdict: "no_signs" },
      { label: "legit", verdict: "no_signs" },
      { label: "legit", verdict: "suspicious" },
      { label: "ambiguous", verdict: "no_signs" },
      { label: "ambiguous", verdict: "scam" },
      { label: "ambiguous", error: "x" },
    ]);
    expect(t).toMatchObject({ n: 8, errors: 1, passed: 4, scams: 3, scamsFlagged: 2, scamsStrict: 1, legit: 2, legitFlagged: 1, ambiguous: 3, ambiguousScam: 1, ambiguousNoSigns: 1 });
    expect(t.falsePositiveRate).toBe(0.5);
  });
  it("computeMetrics ignores ambiguous rows", () => {
    const m = computeMetrics([
      { id: "a", label: "scam", scamType: "job_task", kind: "text", verdict: "scam", predictedType: "job_task", latencyMs: 1 },
      { id: "b", label: "ambiguous", kind: "text", verdict: "scam", latencyMs: 1 },
    ]);
    expect(m.n).toBe(1);
    expect(m.falsePositiveRate).toBe(0);
  });
});
