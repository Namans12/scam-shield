// Where a scene is longer than its footage (the narration decides the length), the last picture is held. A held frame
// is a PNG taken from the recording itself (public/holds/<scene>.png), so it is still real footage.
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const FF = dirname(require.resolve("@remotion/compositor-darwin-arm64/package.json"));
const dir = mkdtempSync(join(tmpdir(), "holds-"));
const out = join(dir, "plan.mjs");
await build({ entryPoints: [resolve(ROOT, "src/plan.ts")], bundle: true, format: "esm", outfile: out, platform: "node", loader: { ".json": "json" }, logLevel: "silent" });
const m = await import(pathToFileURL(out).href);
mkdirSync(resolve(ROOT, "public/holds"), { recursive: true });
const holds = {};
for (const s of m.sceneStarts()) {
  const plan = m.plans[s.id];
  if (!plan) continue;
  const lay = m.layout(plan);
  if (s.frames <= lay.frames) continue;
  const last = lay.segs[lay.segs.length - 1];
  const src = last.owner ? resolve(ROOT, "public/owner-report-clip.mp4") : resolve(ROOT, `public/footage/${last.clip}.mp4`);
  execFileSync(join(FF, "ffmpeg"), ["-y", "-loglevel", "error", "-ss", String(Math.max(0, last.to - 0.05)), "-i", src, "-frames:v", "1", resolve(ROOT, `public/holds/${s.id}.png`)], { cwd: FF });
  holds[s.id] = { seconds: (s.frames - lay.frames) / 30 };
}
writeFileSync(resolve(ROOT, "src/generated/holds.json"), JSON.stringify(holds, null, 1));
rmSync(dir, { recursive: true, force: true });
console.log("held frames:", Object.entries(holds).map(([k, v]) => `${k} ${v.seconds.toFixed(1)}s`).join(", ") || "none");
