// Dev helper: prints the laid-out segments (scene time) of every footage plan, so cuts can be checked against narration.
import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
const dir = mkdtempSync(join(tmpdir(), "layout-"));
const out = join(dir, "plan.mjs");
await build({ entryPoints: [resolve("src/plan.ts")], bundle: true, format: "esm", outfile: out, platform: "node", loader: { ".json": "json" } });
const m = await import(pathToFileURL(out).href);
const only = process.argv[2];
const starts = m.sceneStarts();
for (const [id, plan] of Object.entries(m.plans)) {
  if (only && only !== id) continue;
  const lay = m.layout(plan);
  const st = starts.find((s) => s.id === id);
  console.log(`== ${id}  scene ${(st.frames / 30).toFixed(1)}s  audio ends ${(st.audioEnd / 30).toFixed(1)}s  footage ${(lay.frames / 30).toFixed(1)}s`);
  for (const s of lay.segs) console.log(`   ${(s.start / 30).toFixed(1).padStart(5)}-${((s.start + s.frames) / 30).toFixed(1).padStart(5)}  ${s.clip} ${s.from.toFixed(1)}-${s.to.toFixed(1)}${s.rate ? " x" + s.rate : ""}${s.fade ? " (fade)" : ""}`);
  for (const r of plan.rings) console.log(`   ring ${(m.sceneTime(lay.segs, r.clip ?? lay.segs[0].clip, r.from)).toFixed(1)}-${(m.sceneTime(lay.segs, r.clip ?? lay.segs[0].clip, r.to)).toFixed(1)} ${r.label ?? ""}`);
  if (m.narration[id]) console.log("   narration (scene time):", m.narration[id].sentences.map((x) => ((m.LEAD / 30) + x.start).toFixed(1) + "-" + ((m.LEAD / 30) + x.end).toFixed(1)).join("  "));
}
