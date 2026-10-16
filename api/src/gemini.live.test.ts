import { describe, expect, it } from "vitest";
import { createGeminiModel } from "./gemini";
import { extractEntities } from "./extract";

// Opt-in: hits the real Vertex AI model with Application Default Credentials.
//   RUN_LIVE_GEMINI=1 npm test -w api -- gemini.live
const live = process.env.RUN_LIVE_GEMINI === "1";

const model = () =>
  createGeminiModel({
    project: process.env.GCP_PROJECT ?? "project-91260b43-6705-4176-b71",
    location: "global",
    model: process.env.GEMINI_MODEL ?? "gemini-3.8-flash",
    combinedGrounding: true,
  });

describe.skipIf(!live)("live Gemini verdicts", () => {
  it("flags a KYC scam SMS", async () => {
    const text = "Dear BNB customer, your account will be BLOCKED today due to pending KYC. Update now: https://bnb-kyc-update.web.app or call 7000011111. -BNB Bank";
    const v = await model().analyze({ text, lang: "en", entities: extractEntities(text), hits: [] });
    console.log("KYC scam ->", JSON.stringify(v, null, 2));
    expect(["scam", "suspicious"]).toContain(v.verdict);
    expect(v.red_flags.length).toBeGreaterThan(0);
  }, 60_000);

  it("does not call a genuine-looking debit alert a scam", async () => {
    const text = "Rs 450.00 debited from A/c XX1234 on 16-Oct-26 to VPA grocer@ybl. UPI Ref 628391045522. If not you, call 1800-000-0000. -BNB Bank";
    const v = await model().analyze({ text, lang: "en", entities: extractEntities(text), hits: [] });
    console.log("Debit alert ->", JSON.stringify(v, null, 2));
    expect(["no_signs", "suspicious"]).toContain(v.verdict);
  }, 60_000);
});
