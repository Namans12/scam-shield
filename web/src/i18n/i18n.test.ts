import { describe, expect, it } from "vitest";
import { en } from "./en";
import { hi } from "./hi";

describe("i18n", () => {
  it("has the same keys in en and hi", () => {
    expect(Object.keys(hi).sort()).toEqual(Object.keys(en).sort());
  });

  it("never calls anything safe", () => {
    for (const v of Object.values(en)) expect(v).not.toMatch(/\bsafe\b/i);
    for (const v of Object.values(hi)) {
      expect(v).not.toMatch(/सुरक्षित/);
      expect(v).not.toMatch(/safe/i);
    }
  });

  it("uses the agreed verdict labels", () => {
    expect(en["verdict.scam"]).toBe("Scam");
    expect(en["verdict.suspicious"]).toBe("Suspicious");
    expect(en["verdict.no_signs"]).toBe("No scam signs found");
    expect(hi["verdict.scam"]).toBe("धोखाधड़ी");
    expect(hi["verdict.suspicious"]).toBe("संदिग्ध");
    expect(hi["verdict.no_signs"]).toBe("धोखाधड़ी के संकेत नहीं मिले");
  });

  it("keeps the same {placeholders} in both languages", () => {
    const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const k of Object.keys(en) as (keyof typeof en)[]) expect(vars(hi[k])).toEqual(vars(en[k]));
  });
});
