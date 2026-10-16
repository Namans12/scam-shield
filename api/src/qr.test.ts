import { describe, expect, it } from "vitest";
import QRCode from "qrcode";
import sharp from "sharp";
import { decodeQr, parseUpiUri } from "./qr";

const uri = "upi://pay?pa=bnbreward.cashback@ybl&pn=Cashback%20Reward&am=5000&tn=Reward%20credit&cu=INR";

describe("decodeQr", () => {
  it("decodes a generated QR PNG", async () => {
    const png = await QRCode.toBuffer(uri, { width: 400 });
    expect(await decodeQr(png)).toBe(uri);
  });
  it("returns null for an image with no QR code", async () => {
    const blank = await sharp({ create: { width: 200, height: 200, channels: 3, background: "#fff" } }).png().toBuffer();
    expect(await decodeQr(blank)).toBeNull();
  });
  it("returns null (never throws) for a garbage buffer", async () => {
    expect(await decodeQr(Buffer.from("this is not an image"))).toBeNull();
    expect(await decodeQr(Buffer.alloc(0))).toBeNull();
  });
  it("decodes a QR in an image wider than 1600px", async () => {
    const png = await QRCode.toBuffer(uri, { width: 400 });
    const big = await sharp({ create: { width: 2400, height: 1800, channels: 3, background: "#fff" } })
      .composite([{ input: png, left: 1000, top: 700 }]).png().toBuffer();
    expect(await decodeQr(big)).toBe(uri);
  });
});

describe("parseUpiUri", () => {
  it("parses a upi://pay URI", () => {
    expect(parseUpiUri(uri)).toEqual({ pa: "bnbreward.cashback@ybl", pn: "Cashback Reward", am: "5000", tn: "Reward credit" });
  });
  it("rejects non-UPI strings", () => {
    expect(parseUpiUri("https://example.com")).toBeNull();
  });
  it("returns null when pa is missing", () => {
    expect(parseUpiUri("upi://pay?pn=Someone&am=10")).toBeNull();
  });
  it("is case-insensitive on scheme/host and lower-cases pa", () => {
    expect(parseUpiUri("UPI://PAY?PA=X@YBL")).toEqual({ pa: "x@ybl" });
  });
  it("does not throw on malformed input", () => {
    expect(() => parseUpiUri("upi://pay?pa=%zz&pn=%")).not.toThrow();
    expect(parseUpiUri("")).toBeNull();
  });
});
