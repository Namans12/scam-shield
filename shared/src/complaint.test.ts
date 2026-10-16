import { describe, expect, it } from "vitest";
import { buildComplaint } from "./complaint";
import type { CheckResult } from "./types";

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
});
