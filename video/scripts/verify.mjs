// Automated checks on the composition (and the rendered file, when present). Exits non-zero on failure.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { ROOT, getBundle, getComposition } from "./remotion-lib.mjs";
import { readBench } from "./bench.mjs";

const require = createRequire(import.meta.url);
const FF = dirname(require.resolve("@remotion/compositor-darwin-arm64/package.json"));
const probe = (args) => execFileSync(join(FF, "ffprobe"), ["-v", "error", ...args], { cwd: FF, encoding: "utf8" }).trim();
let failed = 0;
const check = (ok, msg) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`);
  if (!ok) failed++;
};

const comp = await getComposition(await getBundle());
const fps = comp.fps;
const total = comp.durationInFrames / fps;
check(total <= 175, `composition length ${total.toFixed(1)} s <= 175 s (organisers' limit 180 s)`);
check(total >= 155, `composition length ${total.toFixed(1)} s >= 155 s (target window 2:35 to 2:50)`);
check(comp.width === 1920 && comp.height === 1080 && fps === 30, `1920x1080 @ 30 fps (${comp.width}x${comp.height} @ ${fps})`);

const tl = JSON.parse(readFileSync(join(ROOT, "src/generated/timeline.json"), "utf8"));
const LEAD = 15;
const rows = comp.props.table;
let prevEnd = 0;
for (const r of rows) {
  const audio = tl.scenes[r.id].duration;
  const aStart = (r.start + LEAD) / fps;
  const aEnd = aStart + audio;
  const sceneEnd = (r.start + r.frames) / fps;
  check(aStart >= prevEnd - 1e-6, `${r.id}: narration starts ${aStart.toFixed(2)} s, previous narration ended ${prevEnd.toFixed(2)} s (no overlap)`);
  check(aEnd <= sceneEnd - 0.2, `${r.id}: narration ends ${aEnd.toFixed(2)} s, scene ends ${sceneEnd.toFixed(2)} s (no cut-off)`);
  const mp3 = join(ROOT, "public/audio", `${r.id}.mp3`);
  const actual = parseFloat(probe(["-show_entries", "format=duration", "-of", "csv=p=0", mp3]));
  check(Math.abs(actual - audio) < 0.1, `${r.id}: audio file ${actual.toFixed(2)} s matches measured ${audio.toFixed(2)} s`);
  prevEnd = aEnd;
}
const last = rows[rows.length - 1];
check((last.start + last.frames) === comp.durationInFrames, "last scene ends exactly at the composition end");

const b = readBench();
const nar = readFileSync(join(ROOT, "narration/narration.resolved.json"), "utf8");
check(nar.includes(b.cases === 50 ? "fifty" : String(b.cases)), "narration quotes the benchmark case count from eval/results/latest.md");
check(!/\bsafe\b/i.test(nar.replace(/Scam Shield/g, "")), 'narration never uses "safe" as a verdict');
check(!/recover/i.test(nar), "narration never mentions recovery");
const caps = JSON.stringify(Object.values(tl.scenes).flatMap((s) => s.sentences.map((x) => x.caption)));
check(!/\brecover/i.test(caps), "captions never mention recovery");

const mp4 = join(ROOT, "out/scam-shield-demo.mp4");
if (existsSync(mp4)) {
  const dur = parseFloat(probe(["-show_entries", "format=duration", "-of", "csv=p=0", mp4]));
  check(dur <= 175, `rendered file duration ${dur.toFixed(2)} s <= 175 s`);
  const streams = probe(["-show_entries", "stream=codec_name,codec_type,width,height,r_frame_rate", "-of", "csv=p=0", mp4]).split("\n");
  check(streams.some((s) => s.startsWith("h264") && s.includes("1920,1080")), `video stream is H.264 1920x1080 (${streams[0]})`);
  check(streams.some((s) => s.startsWith("aac")), "audio stream is AAC");
  console.log(`      size ${(statSync(mp4).size / 1e6).toFixed(1)} MB`);
} else console.log("(no rendered final mp4 yet)");
if (failed) {
  console.error(`${failed} check(s) failed`);
  process.exit(1);
}
console.log("all checks passed");
