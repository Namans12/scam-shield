import { describe, expect, it } from "vitest";
import { buildComplaint } from "./complaint";
import { SCAM_TYPES, type CheckResult } from "./types";

const fixture: CheckResult = {
  verdict: "scam", risk_score: 95, scam_type: "kyc_update", summary: "Fake KYC message asking to click a link.",
  red_flags: [{ flag: "Urgency", evidence: "blocked today", why_it_matters: "Pressure." }],
  next_steps: [],
  entities: { phones: ["+917000011111"], upi_ids: ["bnbreward.cashback@ybl"], urls: ["https://bnb-kyc-update.web.app"], bank_accounts: [], brands_impersonated: ["BNB"] },
  language: "en", id: "abc", createdAt: "2026-10-16T09:00:00.000Z", inputKind: "text",
  entityKeys: ["phone:+917000011111", "upi:bnbreward.cashback@ybl", "domain:bnb-kyc-update.web.app"],
  hits: [], hardSignals: [], latencyMs: 1200,
};

describe("buildComplaint", () => {
  it("includes identifiers, amount, helpline and portal in English", () => {
    const en = buildComplaint(fixture, { amountLost: "₹5,000", incidentAt: "16 Oct 2026, 2:30 PM", lang: "en" });
    for (const s of ["+917000011111", "bnbreward.cashback@ybl", "bnb-kyc-update.web.app", "₹5,000", "1930", "cybercrime.gov.in", "16 Oct 2026, 2:30 PM"]) {
      expect(en).toContain(s);
    }
    expect(en.toLowerCase()).not.toContain("confirmed");
  });
  it("writes Hindi complaints", () => {
    const hi = buildComplaint(fixture, { lang: "hi" });
    expect(hi).toContain("शिकायत");
    expect(hi).toContain("1930");
    expect(hi.toLowerCase()).not.toContain("confirmed");
  });
  it("omits amount and date when not given", () => {
    const en = buildComplaint(fixture, { lang: "en" });
    expect(en).not.toContain("Amount lost");
  });
  it("is first-person and factual, not addressed to the reader", () => {
    const en = buildComplaint(fixture, { lang: "en" });
    expect(en).toContain("I received a suspicious message.");
    expect(en).toContain("designed to steal the recipient's personal and financial details");
    expect(en).not.toMatch(/steal your|your (account|bank|money)/i);
    expect(en).not.toContain(fixture.summary);
    expect(en).toContain("Urgency");
    expect(en).toContain("KYC update scam");
    expect(en).toContain("It appears to impersonate: BNB.");
  });
  it("mentions no attachment for text and link checks", () => {
    for (const inputKind of ["text", "link"] as const) {
      for (const lang of ["en", "hi"] as const) {
        const out = buildComplaint({ ...fixture, inputKind }, { lang });
        expect(out).not.toMatch(/attached/i);
        expect(out).not.toContain("संलग्न");
        expect(out).not.toMatch(/screenshot|स्क्रीनशॉट|recording|रिकॉर्डिंग/i);
      }
    }
    expect(buildComplaint(fixture, { lang: "en" })).toContain("I can provide the original message or link on request.");
    expect(buildComplaint(fixture, { lang: "hi" })).toContain("मूल संदेश");
  });
  it("mentions the attachment only for image and audio checks", () => {
    expect(buildComplaint({ ...fixture, inputKind: "image" }, { lang: "en" })).toContain("Screenshot of the suspicious message (attached)");
    expect(buildComplaint({ ...fixture, inputKind: "image" }, { lang: "hi" })).toContain("स्क्रीनशॉट (संलग्न)");
    expect(buildComplaint({ ...fixture, inputKind: "audio" }, { lang: "en" })).toContain("Recording of the suspicious call or voice message (attached)");
    expect(buildComplaint({ ...fixture, inputKind: "audio" }, { lang: "hi" })).toContain("रिकॉर्डिंग (संलग्न)");
    expect(buildComplaint({ ...fixture, inputKind: "image" }, { lang: "en", hasAttachment: false })).not.toMatch(/attached/i);
    expect(buildComplaint(fixture, { lang: "en", hasAttachment: true })).toContain("(attached)");
  });
  it("uses the language's scam-type label and has a Hindi summary for every type", () => {
    const hi = buildComplaint(fixture, { lang: "hi" });
    expect(hi).toContain("KYC अपडेट की धोखाधड़ी");
    expect(hi).toContain("मुझे एक संदिग्ध संदेश मिला।");
    for (const scam_type of SCAM_TYPES) {
      for (const lang of ["en", "hi"] as const) {
        const out = buildComplaint({ ...fixture, scam_type }, { lang });
        expect(out).toContain(lang === "en" ? "It " : "यह ");
        expect(out).not.toContain("undefined");
      }
    }
  });
});
