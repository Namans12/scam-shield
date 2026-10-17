// Writes the .srt from the same caption cues (sentence timings measured from the audio) that are burned into the video.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./remotion-lib.mjs";

const stamp = (s) => {
  const ms = Math.round(s * 1000);
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};
export function srtCues(comp) {
  const fps = comp.fps;
  const timeline = JSON.parse(readFileSync(join(ROOT, "src/generated/timeline.json"), "utf8"));
  const lead = 15; // LEAD frames, see src/plan.ts
  const cues = [];
  for (const row of comp.props.table) {
    for (const s of timeline.scenes[row.id].sentences) cues.push({ from: (row.start + lead + Math.round(s.start * fps)) / fps, to: (row.start + lead + Math.round(s.end * fps)) / fps + 0.15, text: s.caption });
  }
  return cues;
}
export function writeSrt(comp, file) {
  const cues = srtCues(comp);
  writeFileSync(file, cues.map((c, i) => `${i + 1}\n${stamp(c.from)} --> ${stamp(c.to)}\n${c.text}\n`).join("\n"));
  console.log(`wrote ${file} (${cues.length} cues)`);
}
