import { describe, expect, it } from "vitest";
import type { Case } from "./cases";
import { renderReport, type LiveRow } from "./report";

const cases: Case[] = [
  { id: "a01", kind: "text", label: "scam", scam_type: "kyc_update", category: "adversarial", expect: "flagged", tactic: "injection", text: "Your account is blocked, update KYC at http://x-kyc.top and share OTP" },
  { id: "l01", kind: "text", label: "legit", category: "lookalike", expect: "not_flagged", tactic: "genuine", text: "Rs 100 debited from A/c XX1234. Avl Bal Rs 900." },
  { id: "m01", kind: "text", label: "ambiguous", category: "ambiguous", expect: "any_not_scam", tactic: "garbage", text: "asdf" },
];
const row = (id: string, label: LiveRow["label"], category: string, verdict: LiveRow["verdict"]): LiveRow => ({ id, label, category, kind: "text", verdict, predictedType: "none", riskScore: 10, latencyMs: 1000, attempts: 1, summary: "model summary", hardSignals: [] });

describe("renderReport", () => {
  it("lists a false positive with the message and the model's words, and reports no hard signals", () => {
    const md = renderReport({
      rows: [row("a01", "scam", "adversarial", "scam"), row("l01", "legit", "lookalike", "suspicious"), row("m01", "ambiguous", "ambiguous", "no_signs")],
      cases, v1Cases: cases, base: "https://x", lang: "en", gapMs: 2500, runAt: "now", liveCalls: 3, casesFile: "cases-v2.jsonl",
    });
    expect(md).toContain("FALSE POSITIVE");
    expect(md).toContain("model summary");
    expect(md).toContain("Rs 100 debited");
    expect(md).toContain("hardSignals` was empty on every row");
    expect(md).toContain("Keyword baseline");
  });
  it("says so when everything passes", () => {
    const md = renderReport({ rows: [row("a01", "scam", "adversarial", "scam")], cases, v1Cases: cases, base: "b", lang: "en", gapMs: 1, runAt: "n", liveCalls: 1, casesFile: "cases-v2.jsonl" });
    expect(md).toContain("None: every case passed.");
  });
});
