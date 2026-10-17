// Publishes the raw clips into public/footage/ and writes the manifest (marks, regions, snaps) the Remotion project reads.
// Clips recorded by capture/record.mjs are already constant-30fps H.264 mp4 (copied as is). A legacy .webm without an mp4
// next to it is converted with the ffmpeg that ships with Remotion. Usage: node scripts/convert.mjs
import { execFileSync } from "node:child_process";
import { readdirSync, mkdirSync, writeFileSync, readFileSync, existsSync, copyFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const ffmpeg = resolve(dirname(require.resolve("@remotion/compositor-darwin-arm64/package.json")), "ffmpeg");
const raw = resolve(ROOT, "footage/raw");
const out = resolve(ROOT, "public/footage");
mkdirSync(out, { recursive: true });
const manifest = {};
for (const f of readdirSync(raw).filter((f) => f.endsWith(".json") && !f.endsWith(".state.json"))) {
  const meta = JSON.parse(readFileSync(resolve(raw, f), "utf8"));
  const name = meta.name;
  const mp4 = resolve(raw, `${name}.mp4`);
  const webm = resolve(raw, `${name}.webm`);
  if (existsSync(mp4)) copyFileSync(mp4, resolve(out, `${name}.mp4`));
  else if (existsSync(webm))
    execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-i", webm, "-r", "30", "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", resolve(out, `${name}.mp4`)], { cwd: dirname(ffmpeg) });
  else continue;
  manifest[name] = meta;
  console.log("published", name, `${meta.duration.toFixed(1)}s`);
}
mkdirSync(resolve(ROOT, "src/generated"), { recursive: true });
writeFileSync(resolve(ROOT, "src/generated/footage.json"), JSON.stringify(manifest, null, 1));
// A committed copy: the marks, element boxes and timings of the clips the published video was cut from.
writeFileSync(resolve(ROOT, "footage/manifest.json"), JSON.stringify(manifest, null, 1));
