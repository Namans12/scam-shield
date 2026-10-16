import { describe, expect, it } from "vitest";
import { maskIdentifier } from "./mask";

describe("maskIdentifier", () => {
  it("masks phones", () => {
    expect(maskIdentifier("phone:+919876543210")).toBe("+91 98XXXXX210");
  });
  it("masks upi ids", () => {
    expect(maskIdentifier("upi:refund.sbi@ybl")).toBe("re******bi@ybl");
  });
  it("leaves domains unmasked", () => {
    expect(maskIdentifier("domain:bnb-kyc-update.web.app")).toBe("bnb-kyc-update.web.app");
  });
  it("masks accounts", () => {
    expect(maskIdentifier("acct:123456789012")).toBe("XXXXXXXX9012");
  });
});
