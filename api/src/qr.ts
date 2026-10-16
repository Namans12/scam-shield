import jsQR from "jsqr";
import sharp, { type Sharp } from "sharp";
import type { UpiPayload } from "@scam-shield/shared";

const MAX_WIDTH = 1600;

type Pipeline = (img: Sharp) => Sharp;

async function scan(image: Buffer, prep: Pipeline): Promise<string | null> {
  const base = sharp(image, { failOn: "none" });
  const { width: srcWidth } = await base.metadata();
  let img = base;
  if (srcWidth && srcWidth > MAX_WIDTH) img = img.resize({ width: MAX_WIDTH });
  const { data, info } = await prep(img).raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 4) return null;
  const code = jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), info.width, info.height);
  return code?.data ? code.data : null;
}

/** Decode the first QR code found in an image. Never throws: returns null on any failure. */
export async function decodeQr(image: Buffer): Promise<string | null> {
  const passes: Pipeline[] = [
    (img) => img.ensureAlpha(),
    (img) => img.grayscale().normalise().toColourspace("srgb").ensureAlpha(),
  ];
  for (const prep of passes) {
    try {
      const result = await scan(image, prep);
      if (result) return result;
    } catch {
      // corrupt / non-image input or decoder failure: try next pass, then give up
    }
  }
  return null;
}

/** Parse a upi://pay URI. Returns null for anything else or when `pa` is missing. */
export function parseUpiUri(raw: string): UpiPayload | null {
  try {
    const m = /^upi:\/\/pay\?([^#]*)/i.exec(raw.trim());
    if (!m) return null;
    const params = new Map<string, string>();
    for (const [k, v] of new URLSearchParams(m[1])) {
      const key = k.toLowerCase();
      if (!params.has(key)) params.set(key, v);
    }
    const pa = params.get("pa")?.trim().toLowerCase();
    if (!pa) return null;
    const out: UpiPayload = { pa };
    for (const f of ["pn", "am", "tn"] as const) {
      const v = params.get(f);
      if (v) out[f] = v;
    }
    return out;
  } catch {
    return null;
  }
}
