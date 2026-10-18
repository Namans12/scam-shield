import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadCases, validateCases, type Case } from "./cases";
import { classify } from "./baseline";

const here = dirname(fileURLToPath(import.meta.url));
const v1 = loadCases(resolve(here, "cases.jsonl"));
const v2 = loadCases(resolve(here, "cases-v2.jsonl"));

/** Identifiers seeded into the demo scam list (scripts/seed.ts GROUPS): cases using them would be list-assisted. */
function seededValues(): string[] {
  const src = readFileSync(resolve(here, "../scripts/seed.ts"), "utf8");
  const groups = src.slice(src.indexOf("export const GROUPS"), src.indexOf("];", src.indexOf("export const GROUPS")));
  return [...groups.matchAll(/"(?:phone|upi|domain|acct):([^"]+)"/g)].map((m) => m[1]!.toLowerCase());
}

describe("case files", () => {
  it("v1 and v2 pass schema validation", () => {
    expect(validateCases(v1)).toEqual([]);
    expect(validateCases(v2)).toEqual([]);
  });
  it("ids are unique across both files", () => {
    const ids = [...v1, ...v2].map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("never uses a 'safe' label or expectation", () => {
    for (const raw of readFileSync(resolve(here, "cases-v2.jsonl"), "utf8").trim().split("\n")) {
      const c = JSON.parse(raw) as Record<string, unknown>;
      expect(String(c.label)).not.toMatch(/safe/i);
      expect(String(c.expect ?? "")).not.toMatch(/safe/i);
    }
  });
  it("v2 has the intended mix and stays within the live-call budget", () => {
    const n = (cat: string) => v2.filter((c) => c.category === cat).length;
    expect(n("adversarial")).toBeGreaterThanOrEqual(12);
    expect(n("lookalike")).toBeGreaterThanOrEqual(15);
    expect(n("ambiguous")).toBeGreaterThanOrEqual(5);
    expect(v2.length).toBeLessThanOrEqual(40);
    expect(v2.every((c) => c.category && c.expect && c.tactic)).toBe(true);
    expect(v2.filter((c) => c.category === "adversarial").every((c) => c.label === "scam")).toBe(true);
    expect(v2.filter((c) => c.category === "lookalike").every((c) => c.label === "legit")).toBe(true);
    expect(v2.filter((c) => c.category === "ambiguous").every((c) => c.expect === "any_not_scam")).toBe(true);
  });
  it("v2 cases contain no seeded scam-list identifiers (not list-assisted)", () => {
    const seeded = seededValues();
    expect(seeded.length).toBeGreaterThan(0);
    const files = [readFileSync(resolve(here, "cases-v2.jsonl"), "utf8"), readFileSync(resolve(here, "make-assets-v2.ts"), "utf8")].map((s) => s.toLowerCase());
    for (const value of seeded) {
      const bare = value.replace(/^\+91/, "");
      for (const f of files) expect(f, `seeded identifier ${value}`).not.toContain(bare);
    }
  });
  it("v2 asset files exist", () => {
    for (const c of v2.filter((x): x is Case & { asset: string } => !!x.asset)) {
      expect(() => readFileSync(resolve(here, "..", c.asset))).not.toThrow();
    }
  });
  it("every v2 text case runs through the baseline without throwing", () => {
    for (const c of v2.filter((x) => x.kind === "text")) expect(["scam", "suspicious", "no_signs"]).toContain(classify(c.text!).verdict);
  });
});
