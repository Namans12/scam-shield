// Frame-difference analysis of a converted clip: prints the biggest changes (time, size). Used to calibrate how far the
// recorded video runs behind the wall-clock marks written by capture/record.mjs (the video starts a little earlier).
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const ffmpeg = resolve(dirname(require.resolve("@remotion/compositor-darwin-arm64/package.json")), "ffmpeg");
export function diffSeries(file, fps = 20, w = 96, h = 60) {
  const r = spawnSync(ffmpeg, ["-loglevel", "error", "-i", file, "-vf", `scale=${w}:${h},format=gray`, "-r", String(fps), "-c:v", "rawvideo", "-f", "image2pipe", "-"], { cwd: dirname(ffmpeg), maxBuffer: 1 << 30 });
  const buf = r.stdout;
  const n = Math.floor(buf.length / (w * h));
  const out = [];
  for (let i = 1; i < n; i++) {
    let s = 0;
    for (let p = 0; p < w * h; p++) s += Math.abs(buf[i * w * h + p] - buf[(i - 1) * w * h + p]);
    out.push({ t: i / fps, d: s / (w * h) });
  }
  return out;
}
if (process.argv[1].endsWith("diffs.mjs")) {
  const clip = process.argv[2];
  const s = diffSeries(resolve("public/footage", clip + ".mp4"));
  const top = [...s].sort((a, b) => b.d - a.d).slice(0, 14).sort((a, b) => a.t - b.t);
  console.log(top.map((x) => `${x.t.toFixed(2)}:${x.d.toFixed(1)}`).join("  "));
}
