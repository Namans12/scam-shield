// Review stills into out/stills/: every scene start, then one frame every N seconds.
//   node scripts/stills.mjs [--every=5] [--scale=1] [--at=12.5,47] [--keep]
import { renderStill } from "@remotion/renderer";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { ROOT, browserExecutable, getBundle, getComposition } from "./remotion-lib.mjs";

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).split("=")[1];
const every = parseFloat(arg("every", 5));
const scale = parseFloat(arg("scale", 1));
const at = arg("at", "").split(",").filter(Boolean).map(Number);
const out = join(ROOT, "out/stills");
if (!process.argv.includes("--keep")) rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const serveUrl = await getBundle();
const comp = await getComposition(serveUrl);
const { fps, durationInFrames } = comp;
const frames = new Map();
for (let t = 0; t < durationInFrames / fps; t += every) frames.set(Math.round(t * fps), `t${t.toFixed(1)}`);
for (const t of at) frames.set(Math.round(t * fps), `at${t}`);
for (const s of comp.props.table) frames.set(s.start + 12, `${s.id}-start`);
frames.set(durationInFrames - 2, "last");
let n = 0;
for (const [frame, name] of [...frames.entries()].sort((a, b) => a[0] - b[0])) {
  await renderStill({ composition: comp, serveUrl, frame: Math.min(frame, durationInFrames - 1), output: join(out, `${String(frame).padStart(5, "0")}_${name}.png`), browserExecutable: browserExecutable(), scale, imageFormat: "png" });
  n++;
}
console.log(`${n} stills in ${out}; total ${(durationInFrames / fps).toFixed(1)}s`);
console.log(comp.props.table.map((s) => `${s.id.padEnd(12)} ${(s.start / fps).toFixed(1).padStart(6)} - ${((s.start + s.frames) / fps).toFixed(1).padStart(6)}  scene ${(s.frames / fps).toFixed(1)}s  audio ends ${(s.audioEnd / fps).toFixed(1)}s  footage ${(s.visual / fps).toFixed(1)}s`).join("\n"));
