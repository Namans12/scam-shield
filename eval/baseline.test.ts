import { describe, expect, it } from "vitest";
import { classify } from "./baseline";

describe("keyword baseline", () => {
  it("flags a textbook KYC phishing message as scam", () => {
    const r = classify("Your SBI account is blocked. Update PAN and Aadhaar now: http://sbi-kyc.top/login");
    expect(r.verdict).toBe("scam");
    expect(r.matched).toContain("risky TLD / free hosting");
  });
  it("flags lottery with a fee, digital arrest and UPI collect cues", () => {
    expect(classify("You have won the KBC lottery of Rs 25,00,000. Pay Rs 5,000 processing fee to claim. WhatsApp 7000012345").verdict).toBe("scam");
    expect(classify("This is Cyber Police. Money laundering case against you. Stay on video call and tell nobody. Transfer to the RBI safe account").verdict).toBe("scam");
    expect(classify("To receive your Rs 3000 refund, scan this QR code and enter your UPI PIN").verdict).toBe("scam");
  });
  it("does not flag genuine bank alerts and OTP messages", () => {
    expect(classify("HDFC Bank: Rs 1,250.00 debited from A/c XX4521 at SWIGGY. Avl Bal Rs 18,430.55.").verdict).toBe("no_signs");
    expect(classify("482913 is your OTP for login. Do not share this OTP with anyone. Valid for 10 minutes.").verdict).toBe("no_signs");
  });
  it("ignores risky words that are negated warnings", () => {
    expect(classify("Never share your OTP, PIN or password with anyone. Bank officials never ask for it.").verdict).toBe("no_signs");
  });
  it("returns no_signs for empty or garbage input and never throws", () => {
    expect(classify("").verdict).toBe("no_signs");
    expect(classify("asdkjh qweoiu 1234 ???").verdict).toBe("no_signs");
  });
  it("reports a score and the matched rule names", () => {
    const r = classify("Urgent: send OTP now");
    expect(r.score).toBeGreaterThan(0);
    expect(r.matched.length).toBeGreaterThan(0);
    expect(["scam", "suspicious"]).toContain(r.verdict);
  });
  it("can be fooled by a scam-awareness forward (known weakness, documented in eval v2)", () => {
    const r = classify("BEWARE! Scammers send messages like 'Your KYC expired, click http://bnb-kyc-verify.top'. Never click such links.");
    expect(r.verdict).not.toBe("no_signs"); // the quoted link is outside the negated phrase
  });
});
