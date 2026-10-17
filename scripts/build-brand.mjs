// Builds the PWA / favicon PNGs from the final logo (docs/brand/logo-final). Usage: node scripts/build-brand.mjs
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mark = readFileSync(resolve(root, "docs/brand/logo-final/mark-on-dark.svg"));
const NAVY = "#081B32";
const out = (f) => resolve(root, "web/public/icons", f);

/** Mark centred on a navy square. `scale` is the share of the canvas the mark takes (maskable icons need the safe zone). */
async function icon(size, scale, radiusRatio, file) {
  const m = Math.round(size * scale);
  const glyph = await sharp(mark, { density: 384 }).resize(m, m).png().toBuffer();
  const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${Math.round(size * radiusRatio)}" fill="${NAVY}"/></svg>`);
  await sharp(bg).composite([{ input: glyph, left: Math.round((size - m) / 2), top: Math.round((size - m) / 2) }]).png().toFile(out(file));
}

await icon(192, 0.72, 0.22, "icon-192.png");
await icon(512, 0.72, 0.22, "icon-512.png");
await icon(512, 0.58, 0, "icon-maskable-512.png"); // full-bleed, mark inside the 80% safe zone
await icon(180, 0.72, 0, "apple-touch-icon.png");
console.log("icons written");
