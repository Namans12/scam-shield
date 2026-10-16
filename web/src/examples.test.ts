import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { EXAMPLES } from "./examples";
import { en } from "./i18n/en";
import { hi } from "./i18n/hi";

describe("EXAMPLES", () => {
  it("has the four agreed examples in order", () => {
    expect(EXAMPLES.map((e) => e.id)).toEqual(["kyc_sms", "fake_payment", "qr_receive", "digital_arrest"]);
  });

  it("has a title in both languages for every example", () => {
    for (const e of EXAMPLES) {
      expect(en[e.titleKey]).toBeTruthy();
      expect(hi[e.titleKey]).toBeTruthy();
    }
  });

  it("text examples carry text, file examples carry an asset that exists", () => {
    for (const e of EXAMPLES) {
      if (e.kind === "text") {
        expect(e.text).toBeTruthy();
        expect(e.asset).toBeUndefined();
      } else {
        expect(e.asset).toMatch(/^\/examples\/.+\.(png|mp3)$/);
        expect(existsSync(resolve(__dirname, "../public", e.asset!.slice(1)))).toBe(true);
      }
    }
  });

  it("uses fictional identifiers only", () => {
    const kyc = EXAMPLES.find((e) => e.id === "kyc_sms")!;
    expect(kyc.text).toContain("bnb-kyc-update.web.app");
    expect(kyc.text).toContain("7000011111");
  });
});
