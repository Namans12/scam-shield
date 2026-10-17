// Gathers everything the Remotion project reads at render time into public/ and src/generated/:
//  - benchmark numbers from eval/results/latest.md (never hard-coded)       -> src/generated/bench.json
//  - brand and third-party logos from the repository                         -> public/brand/
//  - narration audio (TTS, or your own recordings with --owner)              -> public/audio/
//  - footage clips and their manifest                                        -> public/footage/, src/generated/footage.json
//  - the warning card the live app rendered, the optional owner report clip  -> public/
//  - the scene timeline (durations follow the audio)                         -> src/generated/timeline.json
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { readBench } from "./bench.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = resolve(ROOT, "..");
const require = createRequire(import.meta.url);
const FF = dirname(require.resolve("@remotion/compositor-darwin-arm64/package.json"));
const OWNER = process.argv.includes("--owner") || process.env.USE_OWNER_AUDIO === "1";
const cp = (from, to) => {
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
};
const duration = (file) => parseFloat(execFileSync(resolve(FF, "ffprobe"), ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { cwd: FF, encoding: "utf8" }));

mkdirSync(resolve(ROOT, "src/generated"), { recursive: true });
const bench = readBench();
writeFileSync(resolve(ROOT, "src/generated/bench.json"), JSON.stringify(bench, null, 2));
console.log("benchmark:", JSON.stringify(bench));

for (const f of ["mark-on-dark.svg", "lockup-on-dark.svg", "mark.svg"]) cp(resolve(REPO, "docs/brand/logo-final", f), resolve(ROOT, "public/brand", f));
for (const f of readdirSync(resolve(REPO, "docs/brand/third-party")).filter((f) => f.endsWith(".svg"))) cp(resolve(REPO, "docs/brand/third-party", f), resolve(ROOT, "public/brand", f));

// Audio: regenerate timings with the right source when needed.
const timings = JSON.parse(readFileSync(resolve(ROOT, "narration/timings.json"), "utf8"));
if (OWNER && !/owner/.test(timings.engine)) throw new Error("Run `node narration/synthesize.mjs --owner` first so the timings match your recordings.");
if (!OWNER && /owner/.test(timings.engine)) throw new Error("narration/timings.json was built from owner recordings; run `node narration/synthesize.mjs` (TTS) or pass --owner.");
for (const id of Object.keys(timings.scenes)) cp(resolve(ROOT, "narration/audio", `${id}.mp3`), resolve(ROOT, "public/audio", `${id}.mp3`));

execFileSync("node", [resolve(ROOT, "scripts/convert.mjs")], { stdio: "inherit" });

if (existsSync(resolve(ROOT, "assets/share-card.png"))) cp(resolve(ROOT, "assets/share-card.png"), resolve(ROOT, "public/share-card.png"));
const ownerClip = resolve(ROOT, "assets/owner-report-clip.mp4");
const owner = existsSync(ownerClip) ? { duration: duration(ownerClip) } : null;
if (owner) cp(ownerClip, resolve(ROOT, "public/owner-report-clip.mp4"));
console.log(owner ? `owner report clip found (${owner.duration.toFixed(1)}s)` : "no owner report clip: the dialog footage is used");

writeFileSync(resolve(ROOT, "src/generated/timeline.json"), JSON.stringify({ engine: timings.engine, ownerClip: owner, scenes: timings.scenes }, null, 2));

execFileSync("node", [resolve(ROOT, "scripts/holds.mjs")], { stdio: "inherit" });
