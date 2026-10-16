import { describe, expect, it } from "vitest";
import { GEMINI_RESPONSE_JSON_SCHEMA, geminiVerdictSchema } from "./types";

const validFixture = {
  verdict: "scam",
  risk_score: 92,
  scam_type: "kyc_update",
  summary: "Fake bank KYC message.",
  red_flags: [{ flag: "Urgency", evidence: "account blocked today", why_it_matters: "Pressure stops you thinking." }],
  next_steps: ["Do not click the link"],
  entities: { phones: ["+917000011111"], upi_ids: [], urls: ["https://bnb-kyc-update.web.app"], bank_accounts: [], brands_impersonated: ["BNB"] },
  language: "en",
};

describe("geminiVerdictSchema", () => {
  it("accepts a valid verdict", () => {
    expect(geminiVerdictSchema.safeParse(validFixture).success).toBe(true);
  });
  it("rejects out-of-range risk_score", () => {
    expect(geminiVerdictSchema.safeParse({ ...validFixture, risk_score: 140 }).success).toBe(false);
  });
  it("rejects unknown verdict", () => {
    expect(geminiVerdictSchema.safeParse({ ...validFixture, verdict: "safe" }).success).toBe(false);
  });
  it("defaults arrays to []", () => {
    const { red_flags, next_steps, entities, ...rest } = validFixture;
    const r = geminiVerdictSchema.safeParse({ ...rest, entities: {} });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.red_flags).toEqual([]);
      expect(r.data.next_steps).toEqual([]);
      expect(r.data.entities.phones).toEqual([]);
    }
  });
  it("exposes a JSON schema", () => {
    expect(GEMINI_RESPONSE_JSON_SCHEMA).toMatchObject({ type: "object" });
  });
});
