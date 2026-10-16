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

describe("redact: kept phone in every spelling (round 2)", () => {
  const spellings = ["+919876543210", "919876543210", "09876543210", "9876543210", "+91 98765 43210", "+91-98765-43210", "98765 43210"];
  for (const keep of [["+919876543210"], ["phone:+919876543210"]]) {
    for (const s of spellings) {
      it(`keeps "${s}" with keep=${JSON.stringify(keep)}`, () => {
        expect(redact(`call ${s} now`, keep)).toBe(`call ${s} now`);
      });
    }
  }
  it("still redacts an unkept contiguous Aadhaar-like run next to a kept phone", () => {
    expect(redact("call +919876543210 aadhaar 234567890123", ["+919876543210"])).toBe("call +919876543210 aadhaar [aadhaar]");
  });
});

describe("redact: OTP in longer bank messages (round 2)", () => {
  const cases: [string, string][] = [
    ["OTP for txn of INR 2,500 at XYZ is 482913", "OTP for txn of INR 2,500 at XYZ is [otp]"],
    ["Your one time password, valid for 3 minutes, is 482913", "Your one time password, valid for 3 minutes, is [otp]"],
    ["OTP for order 12345678 is 482913", "OTP for order [otp] is [otp]"],
    ["आपका ओटीपी order 12345678 है 482913", "आपका ओटीपी order [otp] है [otp]"],
    ["Dear customer, your OTP for payment of Rs 1,250.50 to ABC Stores is 482913. Do not share.", "Dear customer, your OTP for payment of Rs 1,250.50 to ABC Stores is [otp]. Do not share."],
  ];
  for (const [input, expected] of cases) {
    it(`redacts: ${input}`, () => {
      expect(redact(input, [])).toBe(expected);
    });
  }
});

describe("redact: scaling", () => {
  it("is fast on 50,000-char adversarial input", () => {
    for (const s of ["a".repeat(50000), "a@".repeat(25000), "1 ".repeat(25000), "1".repeat(50000), "OTP ".repeat(12500), "1-".repeat(25000)]) {
      const t = performance.now();
      redact(s, ["+919876543210", "ab@ybl"]);
      expect(performance.now() - t).toBeLessThan(200);
    }
  });
});

describe("redact: redact every secret-looking number around a label (round 3)", () => {
  const has = (s: string, ...nums: string[]) => nums.forEach((n) => expect(s).not.toContain(n));
  it("OTP followed by a later reference after a colon", () => {
    const out = redact("OTP 482913 for txn. Ref: 55667788", []);
    expect(out).toBe("OTP [otp] for txn. Ref: [otp]");
  });
  it("OTP followed by card ending", () => {
    const out = redact("OTP 482913 valid 10 min. Card ending: 4321", []);
    has(out, "482913");
    expect(out.startsWith("OTP [otp] valid 10 min.")).toBe(true);
  });
  it("OTP followed by an unkept phone", () => {
    const out = redact("OTP 482913. Call: 98765 43210", []);
    has(out, "482913");
    expect(out.startsWith("OTP [otp]. Call:")).toBe(true);
  });
  it("number before the label with a later validity time", () => {
    const out = redact("482913 is your OTP to login. Valid till 1530 hrs", []);
    has(out, "482913");
    expect(out.startsWith("[otp] is your OTP to login.")).toBe(true);
  });
  it("redacts both copies of the code", () => {
    const out = redact("482913 is your verification code. Do not share it. Web code #482913", []);
    has(out, "482913");
    expect(out).toBe("[otp] is your verification code. Do not share it. Web code #[otp]");
  });
  it("keeps a kept phone near the label but redacts the OTP", () => {
    expect(redact("OTP 482913 sent to +919876543210", ["+919876543210"])).toBe("OTP [otp] sent to +919876543210");
  });
  it("still leaves amounts alone", () => {
    expect(redact("OTP 482913 for Rs 2,500 and INR 450.00 at XYZ", [])).toBe("OTP [otp] for Rs 2,500 and INR 450.00 at XYZ");
  });
  it("is fast with many labels and numbers", () => {
    for (const s of ["OTP 12345 ".repeat(5000), "482913 OTP ".repeat(5000), "cvv 123 ".repeat(6000)]) {
      const t = performance.now();
      redact(s, ["+919876543210"]);
      expect(performance.now() - t).toBeLessThan(200);
    }
  });
});
