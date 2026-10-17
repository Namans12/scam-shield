// Renders the demo.  node scripts/render.mjs draft   -> out/scam-shield-demo-draft.mp4 (960x540)
//                    node scripts/render.mjs final   -> out/scam-shield-demo.mp4 (1920x1080, 30 fps, H.264, AAC) + .srt
import { renderMedia } from "@remotion/renderer";
import { mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { ROOT, browserExecutable, getBundle, getComposition } from "./remotion-lib.mjs";
import { writeSrt } from "./srt.mjs";

const mode = process.argv[2] ?? "final";
const draft = mode === "draft";
mkdirSync(join(ROOT, "out"), { recursive: true });
const serveUrl = await getBundle();
const comp = await getComposition(serveUrl);
const out = join(ROOT, "out", draft ? "scam-shield-demo-draft.mp4" : "scam-shield-demo.mp4");
const t0 = Date.now();
let last = -1;
await renderMedia({
  composition: comp,
  serveUrl,
  codec: "h264",
  outputLocation: out,
  scale: draft ? 0.5 : 1,
  crf: draft ? 26 : 16,
  pixelFormat: "yuv420p",
  audioCodec: "aac",
  audioBitrate: "192k",
  imageFormat: "jpeg",
  jpegQuality: draft ? 80 : 95,
  browserExecutable: browserExecutable(),
  concurrency: Math.max(2, Math.min(8, Number(process.env.RENDER_CONCURRENCY ?? 6))),
  onProgress: ({ progress }) => {
    const p = Math.floor(progress * 20);
    if (p !== last) {
      last = p;
      console.log(`render ${p * 5}%  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    }
  },
});
console.log(`wrote ${out} (${(statSync(out).size / 1e6).toFixed(1)} MB, ${(comp.durationInFrames / comp.fps).toFixed(1)} s)`);
if (!draft) writeSrt(comp, join(ROOT, "out", "scam-shield-demo.srt"));
