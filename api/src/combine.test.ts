import { describe, expect, it } from "vitest";
import type { EntityHit, EntityKey, GeminiVerdict } from "@scam-shield/shared";
import { applyHardSignals } from "./combine";

const base: GeminiVerdict = {
  verdict: "no_signs", risk_score: 20, scam_type: "none", summary: "s", red_flags: [], next_steps: [],
  entities: { phones: [], upi_ids: [], urls: [], bank_accounts: [], brands_impersonated: [] }, language: "en",
};
const hit = (key: string, reportCount: number): EntityHit => ({ key: key as EntityKey, reportCount, scamTypes: [], linked: [], lastSeen: "2026-10-16T00:00:00Z" });

describe("applyHardSignals", () => {
  it("escalates to scam when an entity is reported 2+ times", () => {
    expect(applyHardSignals(base, { hits: [hit("phone:+917000011111", 2)] })).toMatchObject({
      verdict: { verdict: "scam", risk_score: 85 }, hardSignals: ["multi_reported_entity"],
    });
  });
  it("escalates to at least suspicious when reported once", () => {
    expect(applyHardSignals({ ...base, risk_score: 10 }, { hits: [hit("upi:x@ybl", 1)] })).toMatchObject({
      verdict: { verdict: "suspicious", risk_score: 60 }, hardSignals: ["reported_entity"],
    });
  });
  it("never lowers a higher verdict or score", () => {
    const r = applyHardSignals({ ...base, verdict: "scam", risk_score: 95 }, { hits: [hit("upi:x@ybl", 3)] });
    expect(r.verdict.risk_score).toBe(95);
    expect(r.verdict.verdict).toBe("scam");
    const s = applyHardSignals({ ...base, verdict: "scam", risk_score: 70 }, { hits: [hit("upi:x@ybl", 1)] });
    expect(s.verdict.verdict).toBe("scam");
    expect(s.verdict.risk_score).toBe(70);
  });
  it("uses the max reportCount across hits", () => {
    expect(applyHardSignals(base, { hits: [hit("upi:a@ybl", 1), hit("phone:+917000011111", 4)] }).hardSignals).toEqual(["multi_reported_entity"]);
  });
  it("flags a UPI pay QR disguised as a receive", () => {
    expect(applyHardSignals(base, { hits: [], qr: { raw: "upi://pay?pa=a@ybl", upi: { pa: "a@ybl" } }, text: "Scan this QR to receive your ₹5,000 cashback" }))
      .toMatchObject({ verdict: { verdict: "scam", risk_score: 85, scam_type: "qr_receive_scam" }, hardSignals: ["qr_pay_disguised_as_receive"] });
  });
  it("does not depend on a clean am value", () => {
    const r = applyHardSignals(base, { hits: [], qr: { raw: "x", upi: { pa: "a@ybl", am: " 5000 \n" } }, text: "refund milega" });
    expect(r.hardSignals).toEqual(["qr_pay_disguised_as_receive"]);
    const r2 = applyHardSignals(base, { hits: [], qr: { raw: "x", upi: { pa: "a@ybl", am: "garbage" } }, text: "you won a prize" });
    expect(r2.hardSignals).toEqual(["qr_pay_disguised_as_receive"]);
  });
  it("keeps a specific scam_type when the QR rule fires", () => {
    const r = applyHardSignals({ ...base, scam_type: "lottery_prize" }, { hits: [], qr: { raw: "x", upi: { pa: "a@ybl" } }, text: "prize won" });
    expect(r.verdict.scam_type).toBe("lottery_prize");
  });
  it("recognises Hindi and Hinglish receive-words, and a reward", () => {
    const qr = { raw: "upi://pay?pa=a@ybl", upi: { pa: "a@ybl" } };
    for (const text of ["Aapko 5000 rupaye milenge, QR scan karein", "इनाम पाने के लिए QR स्कैन करें", "कैशबैक जमा होगा", "You won a reward"]) {
      expect(applyHardSignals(base, { hits: [], qr, text }).hardSignals, text).toEqual(["qr_pay_disguised_as_receive"]);
    }
  });
  it("does not treat \"won't\" as a receive-word", () => {
    expect(applyHardSignals(base, { hits: [], qr: { raw: "upi://pay?pa=a@ybl", upi: { pa: "a@ybl" } }, text: "I won't pay this" }).hardSignals).toEqual([]);
  });
  it("does not fire without receive-words or without a UPI QR", () => {
    expect(applyHardSignals(base, { hits: [], qr: { raw: "x", upi: { pa: "a@ybl" } }, text: "pay the shopkeeper" }).hardSignals).toEqual([]);
    expect(applyHardSignals(base, { hits: [], qr: { raw: "https://x" }, text: "receive cashback" }).hardSignals).toEqual([]);
  });
  it("returns the verdict unchanged when nothing fires", () => {
    expect(applyHardSignals(base, { hits: [] })).toEqual({ verdict: base, hardSignals: [] });
  });
  it("does not mutate its input", () => {
    const copy = structuredClone(base);
    applyHardSignals(base, { hits: [hit("upi:x@ybl", 5)] });
    expect(base).toEqual(copy);
  });
});
