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
  it("decodes a QR from a 1-channel grayscale PNG", async () => {
    const png = await QRCode.toBuffer(uri, { width: 400 });
    const gray = await sharp(png).removeAlpha().grayscale().toColourspace("b-w").png().toBuffer();
    expect((await sharp(gray).metadata()).channels).toBe(1);
    expect(await decodeQr(gray)).toBe(uri);
  });
  it("returns null for an image above the input pixel limit", async () => {
    const huge = await sharp({ create: { width: 8000, height: 8000, channels: 3, background: "#fff" } }).png().toBuffer();
    expect(await decodeQr(huge)).toBeNull();
  });
  it("handles a very tall image without allocating its full raw size", async () => {
    const tall = await sharp({ create: { width: 1500, height: 33000, channels: 3, background: "#fff" } }).png().toBuffer();
    global.gc?.();
    const before = process.memoryUsage().rss;
    await expect(decodeQr(tall)).resolves.toBeNull();
    const growthMb = (process.memoryUsage().rss - before) / 1024 / 1024;
    expect(growthMb).toBeLessThan(150);
  }, 30_000);
  it("decodes a QR near the top of a tall image", async () => {
    const png = await QRCode.toBuffer(uri, { width: 800 });
    const tall = await sharp({ create: { width: 800, height: 1600, channels: 3, background: "#fff" } })
      .composite([{ input: png, left: 0, top: 0 }]).png().toBuffer();
    expect(await decodeQr(tall)).toBe(uri);
  });
});

describe("parseUpiUri", () => {
  it("parses a upi://pay URI", () => {
    expect(parseUpiUri(uri)).toEqual({ pa: "bnbreward.cashback@ybl", pn: "Cashback Reward", am: "5000", tn: "Reward credit" });
  });
  it("decodes + as a space in values", () => {
    expect(parseUpiUri("upi://pay?pa=a@y&tn=Reward+credit")).toEqual({ pa: "a@y", tn: "Reward credit" });
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
