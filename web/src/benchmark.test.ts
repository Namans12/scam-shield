// @vitest-environment node
// The landing page numbers come from web/src/benchmark.generated.json, which `npx tsx eval/aggregate.ts` writes from the
// official runs in eval/results/official.json. This test recomputes them from the raw files with its own small, independent
// implementation (plain node fs, no eval code) and fails on any drift, so the page can never show a number the evidence
// does not support. To fix a failure after a new run: edit eval/results/official.json if needed, then run `npx tsx eval/aggregate.ts`.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import generated from "./benchmark.generated.json";
import { BENCHMARK } from "./benchmark";

const results = resolve(__dirname, "../../eval/results");
interface Case { id: string; kind: string; label: "scam" | "legit" | "ambiguous" }
interface Row { id: string; label: string; verdict?: string; error?: string }
interface Manifest { runs: Array<{ name: string; raw: string; cases: string }> }

/** Percentage with one decimal, from exact integers: half up; exactly 0 and 100 have no decimal; a miss never shows as 100 and a non-zero never as 0. */
function pct(num: number, den: number): string {
  if (den === 0 || num === 0) return "0";
  if (num === den) return "100";
  const floorTenths = Math.floor((num * 1000) / den);
  const twiceRemainder = 2 * (num * 1000 - floorTenths * den);
  const tenths = Math.min(999, Math.max(1, twiceRemainder >= den ? floorTenths + 1 : floorTenths));
  return `${Math.floor(tenths / 10)}.${tenths % 10}`;
}

function recompute() {
  const manifest = JSON.parse(readFileSync(resolve(results, "official.json"), "utf8")) as Manifest;
  const seen = new Set<string>();
  let scams = 0, legit = 0, ambiguous = 0, correct = 0, flaggedScams = 0, flaggedLegit = 0, answeredLegit = 0;
  for (const run of manifest.runs) {
    const cases = readFileSync(resolve(results, run.cases), "utf8").trim().split("\n").map((l) => JSON.parse(l) as Case);
    const byId = new Map(cases.map((c) => [c.id, c]));
    const raw = JSON.parse(readFileSync(resolve(results, run.raw), "utf8")) as { rows: Row[] };
    expect(raw.rows.length, `${run.name}: raw rows vs cases`).toBe(cases.length);
    for (const row of raw.rows) {
      const c = byId.get(row.id);
      expect(c, `${run.name}: case ${row.id}`).toBeDefined();
      expect(row.label, `${run.name}/${row.id}: label`).toBe(c!.label);
      expect(seen.has(row.id), `duplicate id ${row.id}`).toBe(false);
      seen.add(row.id);
      const failed = !!row.error;
      const flagged = !failed && (row.verdict === "scam" || row.verdict === "suspicious");
      if (c!.label === "ambiguous") { ambiguous++; continue; }
      if (c!.label === "scam") { scams++; if (flagged) { flaggedScams++; correct++; } }
      else { legit++; if (!failed) answeredLegit++; if (flagged) flaggedLegit++; else if (!failed) correct++; }
    }
  }
  const counts = { scams, legit, ambiguous, correct, flaggedScams, flaggedLegit, answeredLegit };
  const out = {
    accuracy: pct(correct, scams + legit),
    recall: pct(flaggedScams, scams),
    falsePositive: pct(flaggedLegit, answeredLegit),
    cases: String(scams + legit + ambiguous),
    scams: String(scams),
    genuine: String(legit),
    ambiguous: String(ambiguous),
  };
  return { out, counts };
}

describe("landing benchmark numbers", () => {
  const { out: fresh, counts } = recompute();

  it("benchmark.generated.json equals the numbers recomputed from the official raw results, exactly", () => {
    expect(generated).toEqual(fresh);
  });

  it("BENCHMARK exposes exactly those numbers as strings", () => {
    expect(BENCHMARK).toEqual(fresh);
    for (const v of Object.values(BENCHMARK)) expect(typeof v).toBe("string");
  });

  it("eval/results/combined.md shows the same numbers", () => {
    const md = readFileSync(resolve(results, "combined.md"), "utf8");
    const row = (label: string) => new RegExp(`\\|\\s*${label}[^|]*\\|\\s*([0-9.]+)%`).exec(md)![1];
    expect(row("Accuracy")).toBe(fresh.accuracy);
    expect(row("Scam recall")).toBe(fresh.recall);
    expect(row("False-positive rate")).toBe(fresh.falsePositive);
    const head = /(\d+) synthetic cases: (\d+) scams, (\d+) genuine/.exec(md)!;
    expect([head[1], head[2], head[3]]).toEqual([fresh.cases, fresh.scams, fresh.genuine]);
  });

  it("never overstates: 100 and 0 appear only when there is no miss and no false positive", () => {
    expect(BENCHMARK.recall === "100").toBe(counts.flaggedScams === counts.scams);
    expect(BENCHMARK.accuracy === "100").toBe(counts.correct === counts.scams + counts.legit);
    expect(BENCHMARK.falsePositive === "0").toBe(counts.flaggedLegit === 0);
    for (const v of [BENCHMARK.accuracy, BENCHMARK.recall, BENCHMARK.falsePositive]) expect(v).toMatch(/^(0|100|\d{1,2}\.\d)$/);
  });

  it("lists the official runs next to the case files it joins to", () => {
    const manifest = JSON.parse(readFileSync(resolve(results, "official.json"), "utf8")) as Manifest;
    expect(manifest.runs.map((r) => r.name)).toEqual(["v1", "v2", "v3"]);
    expect(dirname(resolve(results, manifest.runs[0]!.raw))).toBe(results);
  });
});
