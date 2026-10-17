// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BENCHMARK } from "./benchmark";

describe("landing benchmark numbers", () => {
  it("match the latest run in eval/results/latest.md", () => {
    const text = readFileSync(resolve(__dirname, "../../eval/results/latest.md"), "utf8");
    const pick = (label: string) => Number(new RegExp(`\\|\\s*${label}[^|]*\\|\\s*([0-9.]+)%`).exec(text)![1]);
    expect(Number(BENCHMARK.accuracy)).toBe(pick("Accuracy"));
    expect(Number(BENCHMARK.recall)).toBe(pick("Scam recall"));
    expect(Number(BENCHMARK.falsePositive)).toBe(pick("False-positive rate"));
  });
});
