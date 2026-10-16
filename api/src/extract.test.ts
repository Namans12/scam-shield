import { describe, expect, it } from "vitest";
import { extractEntities, normalizePhone, toEntityKeys } from "./extract";

describe("normalizePhone", () => {
  it("normalises Indian mobiles to +91XXXXXXXXXX", () => {
    for (const raw of ["+91-98765-43210", "98765 43210", "09876543210", "०९८७६५४३२१०", "+91 9876543210"]) {
      expect(normalizePhone(raw)).toBe("+919876543210");
    }
  });
  it("keeps toll-free numbers as digits", () => {
    expect(normalizePhone("1800 123 4567")).toBe("18001234567");
    expect(normalizePhone("1860-500-1234")).toBe("18605001234");
  });
  it("rejects non-mobiles", () => {
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("5876543210")).toBeNull();
    expect(normalizePhone("123456789012")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });
});

describe("extractEntities", () => {
  const e = extractEntities(
    "Pay to refund.SBI@YBL now or visit https://bnb-kyc-update.web.app/login?id=7 call 7000011111 a/c 123456789012 IFSC BNBA0001234",
  );
  it("extracts each entity type", () => {
    expect(e.upiIds).toEqual(["refund.sbi@ybl"]);
    expect(e.domains).toEqual(["bnb-kyc-update.web.app"]);
    expect(e.phones).toEqual(["+917000011111"]);
    expect(e.bankAccounts).toEqual(["123456789012"]);
    expect(e.urls).toEqual(["https://bnb-kyc-update.web.app/login?id=7"]);
  });
  it("produces entity keys in phone, upi, domain, acct order", () => {
    expect(toEntityKeys(e)).toEqual(["phone:+917000011111", "upi:refund.sbi@ybl", "domain:bnb-kyc-update.web.app", "acct:123456789012"]);
  });
  it("does not treat emails as UPI ids or domains", () => {
    const m = extractEntities("email me at ravi@gmail.com");
    expect(m.upiIds).toEqual([]);
    expect(m.domains).toEqual([]);
  });
  it("finds bare domains in Hindi text", () => {
    expect(extractEntities("आपका KYC अपडेट करें: bnb-kyc-update.web.app").domains).toEqual(["bnb-kyc-update.web.app"]);
  });
  it("returns empty results for empty input", () => {
    expect(extractEntities("")).toEqual({ phones: [], upiIds: [], urls: [], domains: [], bankAccounts: [] });
    expect(toEntityKeys(extractEntities(""))).toEqual([]);
  });
  it("de-duplicates repeated entities", () => {
    const d = extractEntities("call 9876543210 or +91 98765 43210, visit http://evil.example.com and evil.example.com/x, pay ab@ybl AB@YBL");
    expect(d.phones).toEqual(["+919876543210"]);
    expect(d.domains).toEqual(["evil.example.com"]);
    expect(d.upiIds).toEqual(["ab@ybl"]);
  });
  it("handles Hinglish text with a number", () => {
    const h = extractEntities("Sir aapka account block ho jayega, abhi 9123456780 par call kijiye");
    expect(h.phones).toEqual(["+919123456780"]);
    expect(h.bankAccounts).toEqual([]);
  });
  it("does not treat 12-digit Aadhaar-like or UTR numbers as phones", () => {
    expect(extractEntities("UTR 412345678901 done").phones).toEqual([]);
  });
  it("strips trailing punctuation and www-less host casing", () => {
    expect(extractEntities("Go to HTTPS://Evil-Site.COM/path.").domains).toEqual(["evil-site.com"]);
  });
});

describe("extractEntities account heuristics", () => {
  it("ignores Aadhaar-shaped and UTR-like numbers without an account hint", () => {
    expect(extractEntities("Aadhaar 1234 5678 9012 verify").bankAccounts).toEqual([]);
    expect(extractEntities("UTR 412345678901 credited to your account").bankAccounts).toEqual([]);
  });
  it("keeps Luhn-valid card numbers out of bank accounts", () => {
    expect(extractEntities("account card 4111 1111 1111 1111").bankAccounts).toEqual([]);
  });
});

describe("extractEntities hardening", () => {
  it("does not treat a 12-digit number after an Aadhaar label as a bank account", () => {
    expect(extractEntities("aadhaar no 123456789012 account verify").bankAccounts).toEqual([]);
    expect(extractEntities("आधार 123456789012 खाता").bankAccounts).toEqual([]);
  });
  it("finds a UPI id followed by punctuation", () => {
    expect(extractEntities("pay to ab@ybl, thanks").upiIds).toEqual(["ab@ybl"]);
    expect(extractEntities("pay to ab@ybl.").upiIds).toEqual(["ab@ybl"]);
  });
  it("is fast on long adversarial input", () => {
    for (const s of ["a".repeat(5000), "a.".repeat(2500), "1 ".repeat(2500), "1".repeat(5000), "a@".repeat(2500), "http://" + "a".repeat(5000)]) {
      const t = performance.now();
      extractEntities(s);
      expect(performance.now() - t).toBeLessThan(200);
    }
  });
});
