import jsQR from "jsqr";
import sharp, { type Sharp } from "sharp";
import type { UpiPayload } from "@scam-shield/shared";

const MAX_DIM = 1600;
const MAX_INPUT_PIXELS = 50_000_000;
const TIMEOUT_SECONDS = 5;

interface Rgba { data: Buffer; width: number; height: number }

function jsqrScan({ data, width, height }: Rgba): string | null {
  const code = jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), width, height);
  return code?.data ? code.data : null;
}

async function toRgba(img: Sharp): Promise<Rgba | null> {
  const { data, info } = await img.toColourspace("srgb").ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return info.channels === 4 ? { data, width: info.width, height: info.height } : null;
}

/**
 * Decode the first QR code found in an image. Never throws: returns null on any failure.
 * The image is decoded once and downscaled to fit inside 1600x1600 before raw conversion, so
 * memory is bounded (<= ~10 MB RGBA) regardless of input dimensions.
 */
export async function decodeQr(image: Buffer): Promise<string | null> {
  try {
    const first = await toRgba(
      sharp(image, { failOn: "none", limitInputPixels: MAX_INPUT_PIXELS })
        .timeout({ seconds: TIMEOUT_SECONDS })
        .resize({ width: MAX_DIM, height: MAX_DIM, fit: "inside", withoutEnlargement: true }),
    );
    if (!first) return null;
    const direct = jsqrScan(first);
    if (direct) return direct;
    // Second pass on the already-bounded intermediate: grayscale + normalised contrast.
    const second = await toRgba(
      sharp(first.data, { raw: { width: first.width, height: first.height, channels: 4 } })
        .timeout({ seconds: TIMEOUT_SECONDS })
        .grayscale()
        .normalise(),
    );
    return second ? jsqrScan(second) : null;
  } catch {
    return null; // corrupt / non-image input, over the pixel limit, timeout, or decoder failure
  }
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
