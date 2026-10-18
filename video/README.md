# Scam Shield demo video (built entirely by code)

Remotion (React) composition, real footage recorded from the live site with Playwright, English voice-over from Google Cloud
Text-to-Speech. Everything lives in this folder and has its own `package.json` and `node_modules`; nothing outside `video/` is
touched. Output: `out/scam-shield-demo.mp4` (1920x1080, 30 fps, H.264, AAC) and `out/scam-shield-demo.srt`, about 2:48.

```bash
cd video
npm install            # remotion, playwright, typescript (Remotion bundles its own ffmpeg; Playwright's Chromium is reused)
npm run render         # prep (footage, audio, benchmark numbers) + final render + .srt   (about 4 minutes)
npm run draft          # same at 960x540 for a quick look
npm run stills         # review stills every 5 s and at every scene start -> out/stills/
npm run verify         # automated checks: length <= 175 s, audio fits scenes, no overlaps, no "safe", no recovery claim
npm run studio         # Remotion Studio for live preview
```

On macOS the Remotion ffmpeg may need `chmod +x node_modules/@remotion/compositor-darwin-arm64/{ffmpeg,ffprobe,remotion}` after
install if you see `EACCES`.

## Honesty rules the pipeline enforces

* Product footage is a real recording of https://scam-shield-live.web.app doing real work (real API calls).
  Nothing in the UI is mocked or edited. Each window carries a "Real recording of the live app" tag.
* Waiting for Gemini is sped up exactly 4x and a "Sped up 4x" badge is on screen the whole time (it is derived from the playback
  rate, so it cannot be forgotten). A failed check aborts the recording (`record.mjs` throws), so it is recorded again.
* The live landing page no longer carries a recovery percentage (`docs/submission/sources.md` explains why the claim was removed).
  `record.mjs` still contains a guard that jumps past a "recovered" statistics strip if one ever comes back; on the current site it
  simply scrolls. The video never mentions recovery (`npm run verify` checks the narration and captions).
* Verdict words are Scam, Suspicious, No scam signs found; the word "safe" is not used as a verdict (`verify` checks the script).
* Benchmark numbers are read from `eval/results/combined.md (combined over all official live runs)` when you run `npm run prep` (`scripts/bench.mjs`); the narration
  sentence that quotes them is generated from the same numbers, and the caveat ("a small test, not a guarantee") is on screen.
* "Reported 3 times" and the Trends page come from demo data pre-loaded in the shared list; the video says so on screen and in the
  narration.
* The Share card is the PNG the app's own renderer produced for the real result. A headless browser has no OS share sheet, so
  `record.mjs` installs a minimal `navigator.share` that only captures the file the app hands over (that is the only stand-in).
* Report needs a Google sign-in, which is never performed. The Report dialog is shown opening (explanation and sign-in step).

## Re-recording footage

`capture/record.mjs` records one clip per scene (separately re-recordable):

```bash
npm run capture -- kyc            # or: landing kyc actions qr voice payment hindi mobile   (no argument = all)
```

* Real checks per full run: kyc, qr, voice, payment, hindi, mobile = 6 (`actions` re-uses the kyc session and costs none).
  The API is rate limited (60 per minute per IP); the project budget for this video was about 12 checks in total.
* `actions` needs `footage/raw/kyc.state.json` (written by the `kyc` run) so it can reopen the same result.
* Clips are recorded from the CDP screencast that Playwright's `recordVideo` uses, but every frame keeps its true timestamp, so
  the marks written to `footage/raw/<clip>.json` are exact (Playwright's own recordVideo drifted about 7% against wall-clock).
  A smooth, slowed-down pointer is injected into the page (Playwright does not draw the real cursor).
* The clips carry marks and element boxes ("snaps": the quoted evidence, "Reported 3 times", the QR card, ...). `src/plan.ts`
  (the edit decision list) refers to those, so cuts, zooms and highlight rings follow a re-recording. The AI wording differs between
  runs, so after re-recording look at the stills; in particular the order of the payment warning signs (date, reference length,
  sender) is fixed by the text of the labels in `plan.ts`.
* `npm run prep` publishes clips to `public/footage/` and writes `footage/manifest.json` (committed; the raw clips are git-ignored).
* `capture/record.mjs mobile` is the phone-sized (390x844) clip.

## Voice-over

`narration/narration.json` holds each scene's sentences: `say` (spelled for pronunciation) and `caption` (burned in and in the
`.srt`). `{{tokens}}` are filled from the benchmark file.

```bash
npm run voice            # Google Cloud Text-to-Speech, en-IN Chirp3 HD "Achird"; needs `gcloud auth login` (gcloud on PATH)
```

It synthesises one sentence at a time (exact caption timing), joins them into `narration/audio/<scene>.mp3` and writes
`narration/timings.json`. Scene lengths follow the measured audio. If TTS fails it falls back to macOS `say` (and logs it); this
build used Cloud TTS, no fallback. Change the voice in `narration.json` (`voice.name`).

### Using your own voice

Record each scene as `narration/audio-owner/<scene>.mp3` (names: intro, landing, kyc, qr, voice, payment, actions, phone, hindi,
architecture, benchmark, closing; read the `say` sentences in `narration/narration.resolved.json`), then:

```bash
npm run voice:owner      # measures your files, spreads caption timing over them by sentence length
npm run prep:owner       # uses them instead of the TTS files
node scripts/render.mjs final
```

Keep the total under 175 s (`npm run verify` fails otherwise). Go back to TTS with `npm run voice && npm run prep`.

### Optional owner clip for the Report moment

If `video/assets/owner-report-clip.mp4` exists at render time (about 8 seconds, signed in with Google, adding a number to the
list), it replaces the dialog footage in the "Then you can act" scene (capped at 8 s). Delete it to go back.

## Layout

| Path | What |
|---|---|
| `capture/` | Playwright recorder (`record.mjs`, `lib.mjs`) |
| `narration/` | script, TTS synthesis, audio, `timings.json` |
| `src/plan.ts` | edit decision list: segments, camera, rings, notes |
| `src/scenes/` | intro, footage scene engine, architecture, benchmark, closing |
| `src/components/` | captions, backdrop and fades |
| `scripts/` | prep, render, stills, verify, srt, helpers |
| `assets/` | `share-card.png` (real card), optional `owner-report-clip.mp4` |
| `out/` | renders and stills (git-ignored) |

## Licence note

Remotion is free for individuals and small companies; companies above its size threshold need a company licence. See
https://www.remotion.dev/license before using it commercially. The footage shows a fictional bank ("Bharat National Bank").
