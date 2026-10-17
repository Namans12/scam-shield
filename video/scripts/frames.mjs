// Dev helper: node scripts/frames.mjs <clip> <outdir> t1 t2 ...  -> PNG frames from public/footage/<clip>.mp4
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const ffmpeg = resolve(dirname(require.resolve("@remotion/compositor-darwin-arm64/package.json")), "ffmpeg");
const [clip, out, ...ts] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
for (const t of ts) execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-ss", t, "-i", resolve(process.env.CLIPDIR ?? "public/footage", clip + ".mp4"), "-frames:v", "1", resolve(out, `${clip}_${t}.png`)], { cwd: dirname(ffmpeg) });
