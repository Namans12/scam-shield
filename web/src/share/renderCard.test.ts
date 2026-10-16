import { describe, expect, it } from "vitest";
import { makeResult } from "@/test/fixtures";
import { warningText } from "./renderCard";

const scam = makeResult({
  entityKeys: ["phone:+917000011111", "domain:bnb-kyc-update.web.app"],
  hits: [{ key: "phone:+917000011111", reportCount: 3, scamTypes: ["kyc_update"], linked: [], lastSeen: "2026-10-16T00:00:00.000Z" }],
});

describe("warningText", () => {
  it("says how often it was reported when there are hits", () => {
    expect(warningText(scam, "en", "https://x.test")).toContain("Reported 3 times");
  });

  it("omits the reported line when there are no hits", () => {
    expect(warningText({ ...scam, hits: [] }, "en", "https://x.test")).not.toContain("Reported");
  });

  it("masks phone numbers and never shows the full number", () => {
    const text = warningText(scam, "en", "https://x.test");
    expect(text).toContain("+91 70XXXXX111");
    expect(text).not.toContain("7000011111");
  });

  it("never says confirmed or safe, in either language", () => {
    for (const lang of ["en", "hi"] as const) {
      const text = warningText(scam, lang, "https://x.test");
      expect(text).not.toMatch(/confirmed|\bsafe\b|सुरक्षित/i);
    }
  });

  it("includes the site link and the 1930 helpline", () => {
    const text = warningText(scam, "en", "https://x.test");
    expect(text).toContain("https://x.test");
    expect(text).toContain("1930");
  });

  it("is written in Hindi when asked", () => {
    expect(warningText(scam, "hi", "https://x.test")).toContain("धोखाधड़ी");
  });
});
