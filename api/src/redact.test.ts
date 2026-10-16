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
