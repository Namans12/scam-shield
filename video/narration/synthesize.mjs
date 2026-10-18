// Voice-over: Google Cloud Text-to-Speech (en-IN), one sentence at a time (so captions get exact timings), joined into
// one mp3 per scene in narration/audio/. Writes narration/timings.json (scene duration + per-sentence start/end).
//   node narration/synthesize.mjs            -> Cloud TTS (falls back to macOS `say` if TTS fails; the fallback is logged)
//   node narration/synthesize.mjs --owner    -> use your own recordings in narration/audio-owner/<scene>.mp3 (no TTS)
//   node narration/synthesize.mjs --say      -> force the macOS `say` fallback
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, rmSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { narrationTokens } from "../scripts/bench.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const FF_DIR = dirname(require.resolve("@remotion/compositor-darwin-arm64/package.json"));
const ffmpeg = (args) => execFileSync(resolve(FF_DIR, "ffmpeg"), ["-y", "-loglevel", "error", ...args], { cwd: FF_DIR });
const duration = (file) => parseFloat(execFileSync(resolve(FF_DIR, "ffprobe"), ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { cwd: FF_DIR, encoding: "utf8" }));

const OWNER = process.argv.includes("--owner");
const FORCE_SAY = process.argv.includes("--say");
const GAP = 0.32; // seconds of silence between sentences
const PROJECT = process.env.PROJECT ?? "project-91260b43-6705-4176-b71";
const dirs = { audio: resolve(ROOT, "narration/audio"), owner: resolve(ROOT, "narration/audio-owner"), cache: resolve(ROOT, ".cache/tts") };
for (const d of Object.values(dirs)) mkdirSync(d, { recursive: true });

const src = JSON.parse(readFileSync(resolve(ROOT, "narration/narration.json"), "utf8"));
const tokens = narrationTokens();
const fill = (s) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => {
  if (!(k in tokens)) throw new Error(`unknown token {{${k}}}`);
  return tokens[k];
});
const scenes = src.scenes.map((sc) => ({ id: sc.id, sentences: sc.sentences.map((s) => ({ say: fill(s.say), caption: fill(s.caption), ...(s.slot ? { slot: s.slot } : {}) })) }));
writeFileSync(resolve(ROOT, "narration/narration.resolved.json"), JSON.stringify({ voice: src.voice, scenes }, null, 2));

let ttsToken;
async function tts(text) {
  const key = createHash("sha1").update(JSON.stringify([src.voice, text])).digest("hex");
  const cached = resolve(dirs.cache, key + ".mp3");
  if (existsSync(cached)) return cached;
  ttsToken ??= execFileSync("gcloud", ["auth", "print-access-token"], { encoding: "utf8", env: { ...process.env, PATH: `${process.env.PATH}:/opt/homebrew/share/google-cloud-sdk/bin` } }).trim();
  const res = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
    method: "POST",
    headers: { authorization: `Bearer ${ttsToken}`, "x-goog-user-project": PROJECT, "content-type": "application/json" },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: src.voice.languageCode, name: src.voice.name },
      audioConfig: { audioEncoding: "MP3", speakingRate: src.voice.speakingRate ?? 1, sampleRateHertz: 44100 },
    }),
  });
  if (!res.ok) throw new Error(`TTS ${res.status}: ${(await res.text()).slice(0, 300)}`);
  writeFileSync(cached, Buffer.from((await res.json()).audioContent, "base64"));
  return cached;
}
function sayFallback(text) {
  const key = createHash("sha1").update("say:" + text).digest("hex");
  const out = resolve(dirs.cache, key + ".mp3");
  if (existsSync(out)) return out;
  const aiff = resolve(dirs.cache, key + ".aiff");
  execFileSync("say", ["-v", "Rishi", "-r", "165", "-o", aiff, text]);
  ffmpeg(["-i", aiff, "-ar", "44100", "-c:a", "libmp3lame", "-q:a", "3", out]);
  rmSync(aiff);
  return out;
}

let engine = OWNER ? "owner recordings" : `Google Cloud Text-to-Speech ${src.voice.name}`;
const timings = { engine, scenes: {} };
for (const sc of scenes) {
  const outFile = resolve(dirs.audio, `${sc.id}.mp3`);
  if (OWNER) {
    const f = resolve(dirs.owner, `${sc.id}.mp3`);
    if (!existsSync(f)) throw new Error(`missing ${f}`);
    copyFileSync(f, outFile);
    const total = duration(outFile);
    const chars = sc.sentences.map((s) => s.say.length);
    const sum = chars.reduce((a, b) => a + b, 0);
    let t = 0;
    timings.scenes[sc.id] = {
      duration: total,
      sentences: sc.sentences.map((s, i) => {
        const d = (total * chars[i]) / sum;
        const r = { start: t, end: t + d, caption: s.caption };
        t += d;
        return r;
      }),
    };
    continue;
  }
  const files = [];
  for (const s of sc.sentences) {
    let f;
    try {
      if (FORCE_SAY) throw new Error("forced");
      f = await tts(s.say);
    } catch (e) {
      if (!FORCE_SAY) console.warn(`TTS failed (${e.message}); falling back to macOS say for the whole run`);
      engine = "macOS say (Rishi), fallback";
      timings.engine = engine;
      f = sayFallback(s.say);
    }
    files.push(f);
  }
  // Join: each sentence padded with GAP of silence (except the last), concatenated. A sentence with `slot` (seconds) keeps
  // at least that long a slot: the speech is followed by extra silence, so everything after it keeps its absolute start time.
  const dur = files.map((f) => duration(f));
  const extra = sc.sentences.map((s, i) => (s.slot ? Math.max(0, s.slot - dur[i]) : 0));
  const inputs = files.flatMap((f) => ["-i", f]);
  const chain = files.map((_, i) => `[${i}:a]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=mono${i < files.length - 1 ? `,apad=pad_dur=${(GAP + extra[i]).toFixed(5)}` : ""}[a${i}]`).join(";");
  const cat = files.map((_, i) => `[a${i}]`).join("") + `concat=n=${files.length}:v=0:a=1[out]`;
  ffmpeg([...inputs, "-filter_complex", `${chain};${cat}`, "-map", "[out]", "-c:a", "libmp3lame", "-b:a", "160k", outFile]);
  let t = 0;
  const sentences = sc.sentences.map((s, i) => {
    const d = dur[i];
    const r = { start: t, end: t + d, caption: s.caption };
    t += d + GAP + extra[i];
    return r;
  });
  timings.scenes[sc.id] = { duration: duration(outFile), sentences };
  console.log(`${sc.id.padEnd(13)} ${timings.scenes[sc.id].duration.toFixed(2)}s`);
}
writeFileSync(resolve(ROOT, "narration/timings.json"), JSON.stringify(timings, null, 2));
const total = Object.values(timings.scenes).reduce((a, s) => a + s.duration, 0);
console.log(`engine: ${timings.engine}\ntotal narration: ${total.toFixed(1)}s`);
