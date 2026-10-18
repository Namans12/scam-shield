import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SCAM_TYPES } from "@scam-shield/shared";
import { loadCases, validateCases, type Case } from "./cases";
import { classify } from "./baseline";

const here = dirname(fileURLToPath(import.meta.url));
const v1 = loadCases(resolve(here, "cases.jsonl"));
const v2 = loadCases(resolve(here, "cases-v2.jsonl"));
const v3 = loadCases(resolve(here, "cases-v3.jsonl"));

/** Identifiers seeded into the demo scam list (scripts/seed.ts GROUPS): cases using them would be list-assisted. */
function seededValues(): string[] {
  const src = readFileSync(resolve(here, "../scripts/seed.ts"), "utf8");
  const groups = src.slice(src.indexOf("export const GROUPS"), src.indexOf("];", src.indexOf("export const GROUPS")));
  return [...groups.matchAll(/"(?:phone|upi|domain|acct):([^"]+)"/g)].map((m) => m[1]!.toLowerCase());
}

describe("case files", () => {
  it("v1, v2 and v3 pass schema validation", () => {
    expect(validateCases(v1)).toEqual([]);
    expect(validateCases(v2)).toEqual([]);
    expect(validateCases(v3)).toEqual([]);
  });
  it("ids are unique across all three files", () => {
    const ids = [...v1, ...v2, ...v3].map((c) => c.id);
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

  it("never uses a 'safe' label or expectation in v3", () => {
    for (const raw of readFileSync(resolve(here, "cases-v3.jsonl"), "utf8").trim().split("\n")) {
      const c = JSON.parse(raw) as Record<string, unknown>;
      expect(String(c.label)).not.toMatch(/safe/i);
      expect(String(c.expect ?? "")).not.toMatch(/safe/i);
    }
  });
  it("v3 is 50 scams over all 13 scam types and 50 genuine messages, text only, within the live-call budget", () => {
    const scams = v3.filter((c) => c.label === "scam");
    const legit = v3.filter((c) => c.label === "legit");
    expect([scams.length, legit.length, v3.length]).toEqual([50, 50, 100]);
    expect(v3.every((c) => c.kind === "text" && c.category && c.expect && c.tactic)).toBe(true);
    const byType = new Map<string, number>();
    for (const c of scams) byType.set(c.scam_type!, (byType.get(c.scam_type!) ?? 0) + 1);
    expect([...byType.keys()].sort()).toEqual(SCAM_TYPES.filter((t) => t !== "none").sort());
    for (const n of byType.values()) expect(n).toBeGreaterThanOrEqual(3);
    expect(scams.every((c) => c.category === "realistic_scam")).toBe(true);
    expect(legit.every((c) => c.category !== "realistic_scam")).toBe(true);
    expect(v3.length).toBeLessThanOrEqual(105);
  });
  it("v3 cases contain no seeded scam-list identifiers (not list-assisted) and reuse no phone number from v1/v2", () => {
    const seeded = seededValues();
    const text = readFileSync(resolve(here, "cases-v3.jsonl"), "utf8").toLowerCase();
    for (const value of seeded) expect(text, `seeded identifier ${value}`).not.toContain(value.replace(/^\+91/, ""));
    const phones = (cs: Case[]) => new Set(cs.flatMap((c) => c.text?.match(/\b[6-9]\d{9}\b/g) ?? []));
    const earlier = phones([...v1, ...v2]);
    for (const p of phones(v3)) expect(earlier.has(p), `phone ${p} already used in v1/v2`).toBe(false);
  });
  it("v3 messages are not near-duplicates of each other or of v1/v2 (word overlap below 70 percent)", () => {
    const words = (t: string) => new Set(t.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
    const jaccard = (a: Set<string>, b: Set<string>) => { let i = 0; for (const w of a) if (b.has(w)) i++; return i / (a.size + b.size - i); };
    const earlier = [...v1, ...v2].filter((c) => c.text).map((c) => ({ id: c.id, w: words(c.text!) }));
    const mine = v3.map((c) => ({ id: c.id, w: words(c.text!) }));
    mine.forEach((a, i) => {
      for (const b of [...earlier, ...mine.slice(i + 1)]) expect(jaccard(a.w, b.w), `${a.id} vs ${b.id}`).toBeLessThan(0.7);
    });
  });
  it("every v3 text case runs through the baseline without throwing", () => {
    for (const c of v3) expect(["scam", "suspicious", "no_signs"]).toContain(classify(c.text!).verdict);
  });
});
