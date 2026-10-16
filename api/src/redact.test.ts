import { describe, expect, it } from "vitest";
import { redact } from "./redact";

describe("redact", () => {
  it("redacts OTP, Aadhaar, PAN and valid cards but keeps listed values", () => {
    expect(redact("Your OTP is 482913. Aadhaar 1234 5678 9012, PAN ABCDE1234F, card 4111 1111 1111 1111, call 7000011111", ["+917000011111"]))
      .toBe("Your OTP is [otp]. Aadhaar [aadhaar], PAN [pan], card [card], call 7000011111");
  });
  it("leaves Luhn-invalid 16-digit runs as is", () => {
    expect(redact("ref 4111 1111 1111 1112", [])).not.toContain("[card]");
  });
  it("returns empty string unchanged", () => {
    expect(redact("", [])).toBe("");
  });
});

describe("redact: OTP/CVV formats (I1)", () => {
  const cases: [string, string][] = [
    ["482913 is OTP for txn of INR 2,500 at XYZ", "[otp] is OTP for txn of INR 2,500 at XYZ"],
    ["OTP for Rs 5000 is 482913", "OTP for Rs 5000 is [otp]"],
    ["OTP for Rs. 5000 is 482913", "OTP for Rs. 5000 is [otp]"],
    ["OTP for ₹5000 is 482913", "OTP for ₹5000 is [otp]"],
    ["Use 482913 as your OTP", "Use [otp] as your OTP"],
    ["OTP482913", "OTP[otp]"],
    ["OTP: 482913", "OTP: [otp]"],
    ["OTP is 4829", "OTP is [otp]"],
    ["आपका ओटीपी 482913 है", "आपका ओटीपी [otp] है"],
    ["आपका ओ.टी.पी 482913 है", "आपका ओ.टी.पी [otp] है"],
    ["आपका वन टाइम पासवर्ड ४८२९१३ है", "आपका वन टाइम पासवर्ड [otp] है"],
    ["CVV 123", "CVV [otp]"],
    ["CVV: 123", "CVV: [otp]"],
  ];
  for (const [input, expected] of cases) {
    it(`redacts: ${input}`, () => {
      const out = redact(input, []);
      expect(out).toBe(expected);
      expect(out).not.toMatch(/482913|4829|\b123\b/);
    });
  }
  it("does not redact a kept phone that follows an OTP word", () => {
    expect(redact("Send OTP to 98765 43210", ["+919876543210"])).toBe("Send OTP to 98765 43210");
  });
  it("does not mangle IFSC after the word code", () => {
    expect(redact("IFSC code BNBA0001234", [])).toBe("IFSC code BNBA0001234");
  });
  it("redacts a number before the OTP word via the OTP_AFTER path", () => {
    expect(redact("482913 is your OTP", [])).toBe("[otp] is your OTP");
  });
});

describe("redact: other behaviour", () => {
  it("matches PAN case-insensitively", () => {
    expect(redact("pan abcde1234f ok", [])).toBe("pan [pan] ok");
  });
  it("redacts contiguous Aadhaar", () => {
    expect(redact("aadhaar 234567890123 done", [])).toBe("aadhaar [aadhaar] done");
  });
  it("keeps a kept 12-digit account that would otherwise look like Aadhaar", () => {
    expect(redact("a/c 123456789012 pay", ["123456789012"])).toBe("a/c 123456789012 pay");
    expect(redact("a/c 123456789012 pay", ["acct:123456789012"])).toBe("a/c 123456789012 pay");
  });
  it("accepts entity keys as keep values", () => {
    expect(redact("OTP 482913 call 7000011111", ["phone:+917000011111"])).toBe("OTP [otp] call 7000011111");
  });
  it("a card number does not swallow an adjacent kept phone", () => {
    expect(redact("call 7000011111 4111 1111 1111 1111", ["+917000011111"])).toBe("call 7000011111 [card]");
  });
  it("is fast on long adversarial input", () => {
    for (const s of ["1 ".repeat(2500), "a".repeat(5000), "1".repeat(5000), "OTP ".repeat(1250), "1-".repeat(2500)]) {
      const t = performance.now();
      redact(s, ["+919876543210"]);
      expect(performance.now() - t).toBeLessThan(200);
    }
  });
});
