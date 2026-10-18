# DETAILS: what was done, what is left, tests and results

> **CURRENT STATE (18 Oct 2026, early morning IST). Read this block first; the older sections below are the history.**
> - **Production = branch `build` = `main`** (kept identical). API image tag = commit on `build`; web deployed from the same commit. Verified live: smoke test, the four examples, 12 parallel checks, benchmark re-run.
> - **New UI:** brand logo (option A, blue), landing page at `/`, checker at `/check`, polished Result/Trends/History/About/Complaint pages, centred-aware carousel, scroll-linked timelines (rail exactly first-to-last node), counting benchmark numbers, plain-text technology names with a trademark and non-affiliation note in English and Hindi (no Google logos on the website; the icon files live in `docs/brand/third-party/`, sources in `docs/brand/third-party-logos.md`, and are used only in deck slides 8-9 and the video architecture scene, each with a footnote). Hindi/English layouts are position-stable (both languages stacked in one grid cell: `web/src/components/landing/LangStack.tsx`).
> - **Benchmark (headline, combined over three live runs, 17-18 Oct, production, gemini-3.7-flash default):** 185 synthetic cases (90 scams, 90 genuine, 5 ambiguous): accuracy 98.3% (177/180), scam recall 100% (90/90), false-positive rate 3.3% (3/90), scam type 96.7%, text p50 4.5 s / p95 18.2 s, 0 errors (`eval/results/combined.md`). The three false positives: a scam-awareness forward quoting a scam link, a courier update with a tracking link, a friend asking to borrow Rs 3,000. These headline numbers are combined and generated from `eval/results/official.json` by `npx tsx eval/aggregate.ts` into `web/src/benchmark.generated.json`; the live-site count-up shows them, and `web/src/benchmark.test.ts` fails if the page drifts from the raw results. The first 50-case run (`latest.md`, 100/100/0) and the Hindi run (first 50 cases only) remain valid history; older runs are kept in `eval/results/`.
> - **API changes:** per-IP check limit raised to 60/min (user 30/day, global 3000/day unchanged), Gemini thinking level LOW, Search grounding off (`GEMINI_SEARCH`), one retry without search. Details in section 1 below ("Gemini reliability").
> - **Claims:** the "victims recover about 2%" claim was UNSUPPORTED and removed everywhere. Sources and status of every statistic: `docs/submission/sources.md`.
> - **Submission PDF has 15 pages:** `scripts/build-deck.sh` drops slide 2 (the organisers' 'download this template' note) from the PDF only (`scripts/drop-slide.py`; `DECK_DROP_SLIDE=0` keeps it). The PPTX keeps all 16 slides, so the links slide is slide 14 in the PPTX and page 13 in the PDF.
> - **Deck:** rebuilt on the organisers' template (the original template file is gone; `docs/submission/template-base.pptx` was reconstructed from the old deck). Rebuild + PDF export with PowerPoint: `DECK_STAGE=<readable folder> bash scripts/build-deck.sh` (`DECK_VIDEO_URL=https://... ` fills the video link on slide 14). PDF 16 pages, about 2.6 MB. Budget alert is created (Rs 2,000/month, 50/90/100%).
> - **18 Oct fix batch (deployed to production, web only; API unchanged):** "Not enough to judge" state for thin input (7+ words, link, phone, UPI ID or a file counts as enough), staged wait steps + "about 20 seconds" copy, collapsed "How this verdict was reached" panel, first-person complaint wording (attachment line only when a file exists), service-worker update prompt, demo-bank "FICTIONAL DEMO" banner, Hindi state names on /trends, privacy copy that matches what is kept. Eval v2 (35 harder cases, 33/35, honest results in `eval/results/run-v2.md`; eval v3, 100 cases, 99/100, in `run-v3.md`), deck rebuilt, video re-rendered (fast-forward badge, "U P I, I D" spoken as letters), docs scrubbed of personal data in current files (git history still holds the old text; owner decides about rewriting it). Budget alert is Rs 2,000/month.
> - **Logos decision (18 Oct, done):** website text-only + trademark note (deployed); deck slides 8-9 and the video Architecture scene keep product icons with a footnote; the video closing card is text-only; the Google Cloud mark was removed from the video title. Deck and video were rebuilt after this change.
> - **Video:** built by code in `video/` (Remotion + real Playwright footage of the live site + Google Cloud TTS voice, 2:48, under the 3-minute limit). Final mp4 is NOT in git (size): `video/out/scam-shield-demo.mp4` (re-rendered 18 Oct after the logo change, 168.5 s) and also in the local `track/video` worktree. See `video/README.md` to re-record, re-voice, or use the owner's own voice, and to drop in an owner clip for the Report scene.
> - **Branches/worktrees (local only):** `track/landing`, `track/pages`, `track/carousel`, `track/video`, `track/deck` were merged into `build`; the extra local worktrees can be removed with `git worktree remove`.
> - **Still the owner's:** real Google sign-in + report test; Android share/install test; confirm the README "Provenance" paragraph; submit the form (`docs/submission/description.md`).
> - **Known risks:** Gemini latency varies (4 to 21 s, rare slower); the share-target run where a result page did not open once is unexplained; 18 Firestore-emulator tests need Java (not installed on this Mac).
> - **Docs cleaned (18 Oct):** private data (personal addresses, billing and account identifiers, local paths, unrelated projects) removed from current files; `HANDOFF.md` rewritten as a short current-state note; `docs/ARCHITECTURE.md` added for judges; README privacy, evaluation and storage statements corrected; video script rewritten to match the shipped video.



Written for the next agent. State as of 17 Oct 2026. Companion docs: `HANDOFF.md` (short current-state note), `docs/ARCHITECTURE.md` (how a check works, for judges), `docs/setup-notes.md` (cloud facts, deploy and hardening notes), `eval/results/latest.md` (benchmark), `README.md` (public description).

- Repo (public): https://github.com/Namans12/scam-shield. Branches `build` and `main` are at the same commit; **`main` is the default branch and is what judges see**. Work on `build`, then fast-forward `main` (`git checkout main && git merge --ff-only build && git push origin main`).
- Live app: https://scam-shield-live.web.app (hosting site `scam-shield-live`, target `app-named`, 18 Oct). The older default site and `scam-shield-check` now 301-redirect to it (`scripts/redirect-site`). `/api/**` goes through the same-origin Hosting rewrite, so no API or CORS change was needed; the new site's `.web.app` and `.firebaseapp.com` domains were added to Firebase Auth authorized domains. Demo bank page: https://bnb-kyc-update.web.app . GCP project `project-91260b43-6705-4176-b71`, region `asia-south1`.
- Hackathon deadline: 18 Oct 2026, 23:59 IST (aim to submit by about 20:00 IST). Freeze deploys about 14:00 IST on the 18th.

## 0. UPDATE, 17 Oct evening (Windows session): verification, model switch, deck, budget alert

**This section supersedes the Gemini model and benchmark numbers further down.** Everything else below still holds.

Verified independently (not just taken from the notes)
- `npm ci` from a clean checkout **failed**: 8 lockfile entries resolved from `registry.npmmirror.com` (a third-party mirror; the other machine's npm config). Fixed by pointing them at `registry.npmjs.org`; every integrity hash still matched.
- `npm run typecheck`: clean. Tests: shared 14, linkscan 94 (after installing Playwright Chromium 1193), web 195, eval 5, api 256 passed and 18 skipped. **The 18 skipped Firestore tests now pass too** (Java 21 is installed on this Windows machine: `npx firebase emulators:exec --only firestore --project demo-scam-shield "npm test -w api -- store"` gives 38 of 38). **`gemini.live.test.ts` passes** (`RUN_LIVE_GEMINI=1 npm test -w api -- gemini.live`, 2 of 2).
- One flaky test fixed properly: `redact.test.ts` "is fast with many labels" failed at 211 ms against a 200 ms budget. `redact()` re-copied the whole string once per edit; it now assembles the result in one pass.
- Dark mode on the live site checked at 375 px (Check page and a full Result page): readable, no horizontal overflow (`scrollWidth` equals `innerWidth`).

Problem found and fixed: Gemini model reliability
- The live smoke test **failed** when re-run: the KYC check took 34 s and the genuine alert returned 502 (`analysis_failed`). Logs: attempt 1 timed out at 15 s, attempt 2 got HTTP 429 "Resource exhausted".
- Probing the models directly on this project: `gemini-3.8-flash` gave 8.5 s for a one-word reply, then a 429, then a 45 s hang. `gemini-3.7-flash`, `gemini-3.5-flash`, `gemini-2.5-flash` and `gemini-2.5-flash-lite` answered in 0.8 to 3.8 s every time (3 samples each).
- Fix (commit `0deca06`): default model is now **`gemini-3.7-flash`**; the retry now goes to **`GEMINI_FALLBACK_MODEL` (default `gemini-2.5-flash`)** because quotas are per model (and `thinkingLevel` is only sent to `gemini-3*` models). `scripts/deploy.sh` sets both. API redeployed (revision `scam-shield-api-00013-h5z`).
- After the fix: live smoke OK twice (KYC 10 to 11 s including the link scan, genuine alert 4 s).
- **New benchmark, first 50 cases only (history; the headline is now the combined 185-case result above)** (`eval/results/latest.md`, 50 cases, sequential, live): accuracy **100.0%**, scam recall **100%** (26/26), false-positive rate **0.0%** (0/24), scam type correct **96.2%** (s05, a QR scam, was labelled `fake_payment`; still flagged Scam), errors 0. Latency: text p50 4.5 s / p95 12.9 s, image p50 8.9 s / p95 9.5 s, audio 14.2 s; slowest single case 23.7 s. The previous `gemini-3.8-flash` run (98.0% / 100% / 4.2%, image p95 33.8 s) is kept in `eval/results/run-gemini-3.8-flash.md`. With 50 cases, 98% vs 100% is one case: do not oversell the difference.
- **Hindi benchmark** (same 50 cases, `--lang hi`, `eval/results/run-hindi.md`): accuracy 100.0%, recall 100%, false positives 0%, scam type correct 100%, errors 0; text p50 5.0 s / p95 8.6 s, image p50 8.0 s, audio 11.6 s.
- README, `docs/submission/description.md` (248 words) and `docs/submission/deck-outline.md` updated with the new model and numbers.

Done in this session
- **Budget alert created**: Rs 2,000 per month (raised from Rs 1,000 on 18 Oct) on the project's billing account, alerts at 50%, 90% and 100% (Budget API enabled on the project for this).
- **Deck built on the organisers' template**: `docs/submission/Scam-Shield-deck.pptx` and `docs/submission/Scam-Shield-deck.pdf` (16 pages, 1.15 MB, under the 5 MB limit). All 16 template slides kept; slides 1 and 3 to 14 filled; rendered with PowerPoint and checked slide by slide for overflow. Regenerate with `python scripts/build-deck.py <template.pptx> <out.pptx>` (the template is the organisers' Google Slides export, not stored in the repo; numbers are read from `eval/results/latest.md`). Export the PDF from PowerPoint (File > Export) after any change.

Needs the owner before submitting
- Slide 1 ("Team name: Nexustrip", product name Scam Shield; "Team leader name: Naman Shrimal"): **confirmed correct by the owner on 17 Oct.**
- The demo video is uploaded (Public): https://youtu.be/a678nAYddq0 . It is in `README.md` and on deck slide 14 (built with `DECK_VIDEO_URL`).
- Everything else under "Owner only" in section 3 (real Google sign-in and report test, Android share and install on a phone, the video, the form).

Small issues noticed, not fixed
- On the live Result page, a red flag whose evidence was taken from the scanned page's text is still labelled "From the message" (example: "OTP received on mobile" from the demo bank page). Cosmetic; the label should say "From the page" when the quote comes from the link scan.
- `scripts/deploy.sh` builds the image from the working tree, so image tags end in `-dirty`; commit before deploying if tags matter.
- `firestore-debug.log` is written to the repo root by the Firestore emulator (now git-ignored).

## 1. What was done (this machine, 16 to 17 Oct)

Setup and deploy
- Installed `gcloud` (Homebrew cask), `firebase-tools` (npm global) and Playwright Chromium (builds 1187, then 1193 for Playwright 1.55.1). Owner logged in to both CLIs.
- Deployed Storage rules (audio up to 15 MB, image up to 10 MB, owner read of `screenshots/{uid}`), Firestore rules and indexes, 7-day `uploads/` lifecycle (verified), `scam-shield-linkscan`, `scam-shield-api`, Hosting. Added a second Hosting site `bnb-kyc-update` (target `demo-bank`) via `firebase.json` and `.firebaserc`. `scripts/deploy.sh web` deploys both targets.
- Chromium sandbox works on Cloud Run gen2 without `LINKSCAN_NO_SANDBOX` (verified with a real scan). Keep it off.
- Repo hygiene: `.firebase/` git-ignored; `package-lock.json` kept free of macOS npm churn (the `libc` fields are restored with a small script after any `npm install`).

Fixes from the polish list (all with tests)
- `redact.ts`: "orders 482913" and "2 hrs 482913" no longer read as "Rs <amount>" (OTP leak).
- Linkscan: context and proxy close are bounded to 5 s; a wedged close resets Chromium so it cannot hold a scan slot.
- API: stored QR payload and stored link-scan title and text are redacted; QR evidence length is capped; Hindi/Hinglish receive-words widened and "won't" excluded (`combine.ts`); prompt no longer says "opened safely", only says a screenshot is attached when one really is, quotes and caps the QR payee name in the grounding prompt, keeps evidence and transcript in the original language, and states today's date in India.
- Web: message box `aria-describedby` for the count and limit note; one-time reload on `vite:preloadError`; `og:image`, `og:url`, `twitter:image`; larger tap targets on About links.
- Linkscan: Playwright and base image bumped to 1.55.1; `SECURITY.md` renderer-process claim corrected; a concurrency test no longer attempts a real network connection.

Task 12: examples, demo site, seed data
- Four one-click examples on the Check page (`web/src/examples.ts`, `ExampleRow.tsx`): fake KYC SMS, fake payment screenshot, QR "receive money", Hindi "digital arrest" voice note.
- Generators in `scripts/examples/` (QR, receipt via Playwright, voice via Cloud Text-to-Speech `hi-IN`), assets in `web/public/examples/`. Fictional demo bank page in `scripts/examples/demo-bank/` (noindex, form submits nowhere).
- `scripts/seed.ts` (idempotent, uses Firestore REST with the gcloud token): seeded entities (`phone:+917000011111` x3, `domain:bnb-kyc-update.web.app` x3, `upi:bnbreward.cashback@ybl` x2, `phone:+917000022222` x2, `upi:cbi.verify.desk@ybl` x2), 7 days of `stats/daily-*`, `stats/recent`. Seeded docs carry `seeded: true`; real data is never overwritten.

Task 13: report, complaint, share
- `signInWithGoogle` (links the anonymous user; falls back to the existing Google account, which changes the uid), `isGoogleUser`, `ensureAnonymousUser` now reads the current user on every call.
- `ReportDialog` (Google sign-in, state, city), `/complaint/:id` page built from the shared template, `ShareWarning` with a canvas card (1080x1350) and `navigator.share` or a WhatsApp link fallback. Result and complaint pages read from Firestore when opened without router state.

Task 14: trends, history, About, share target
- `TrendsPage` (reads `stats/*`), `HistoryPage` (own checks), About with privacy, Google stack and helplines (1930, cybercrime.gov.in, Chakshu).
- Own service worker `web/src/sw.ts` (vite-plugin-pwa `injectManifest`) handles `POST /share-target`; `web/src/share-target/sw-share.ts` parks the share in Cache Storage and `CheckPage` consumes `/?shared=1`. Manifest has `share_target`. Firestore and Storage chunks are excluded from precache.

Gemini reliability (the biggest finding)
- Cause of `analysis_failed` on checks that contain a link: those inputs attach Google Search grounding, which on this project returns 429 after about 4 calls and sometimes hangs 40 s or more.
- Shipped: thinking level `LOW` by default (about 3x faster; `GEMINI_THINKING_LEVEL`), first attempt capped at 15 s and total at 40 s, one retry that always drops search, failure cause logged (`gemini_attempt_failed attempt=N kind=... status=...`, no user content), and `GEMINI_SEARCH` switch (**default off**; deploy with `GEMINI_SEARCH=true` to enable).
- Result: 16 of 16 link and plain checks passed sequentially (5 to 16 s) after search was turned off, then 12 of 12 more after the final deploy.

Task 15, 16, 17, 18, 19
- 15: Hindi checked on all examples (summary, flags, steps in Hindi); 375 px audit of every page (no horizontal overflow; About links fixed); 12 screenshots in `docs/submission/screenshots/` (`npx tsx scripts/screenshots.ts` regenerates them from the live site).
- 16: `eval/` harness, first set of 50 synthetic cases (`cases.jsonl`, 26 scam and 24 genuine, all 13 scam types, 2 Hinglish, the 4 examples, 2 genuine images made by `eval/make-assets.ts`), `metrics.ts`, `run.ts` (sequential, paced to the API's 10 checks per minute per IP, fresh anonymous user per 25 cases, writes `eval/results/*.raw.json` and `latest.md`). The first run exposed a real bug (the model did not know today's date and flagged 2026 dates as "future"); fixed in `buildVerdictPrompt`. Run 1 is kept in `eval/results/run1-before-date-fix.md`.
- 17: X-Forwarded-For measured: 2 entries through Hosting (client plus Google front end), Hosting overwrites a forged header, so `TRUSTED_PROXY_HOPS=2` is right; direct `run.app` calls can spoof the per-IP limiter key (per-user and global caps still apply). API minScale 1; linkscan private (403 unauthenticated), `run.invoker` only for the API service account. Smoke x3 a minute apart all OK.
- 18: WebMCP tools `check_message` and `report_scam` (`web/src/webmcp/`), registered through `navigator.modelContext` (`registerTool`, falling back to `provideContext`). Loaded and executed against the live site with a stub context.
- 19: `README.md`, `docs/submission/description.md` (245 words), `video-script.md`, `deck-outline.md`.

## 2. Tests and results (17 Oct; the benchmark numbers here are superseded by section 0 and `eval/results/latest.md`)

`npm run typecheck`: 0 errors in all workspaces. `npm test`:

| Workspace | Result |
|---|---|
| shared | 14 passed |
| api | 252 passed, 18 skipped (the Firestore-emulator suite and the live-Gemini tests, see below) |
| linkscan | 94 passed (needs Playwright Chromium 1193) |
| web | 195 passed (17 files) |
| eval | 5 passed (metrics) |

- Live smoke (`bash scripts/smoke.sh <url>`): SMOKE OK (landing page, health, anonymous sign-in, KYC scam text, genuine alert, 401 without or with a bad token). Run three times a minute apart: all OK.
- Live examples (`/api/check` for each of the four): all return Scam (98, 98, 98, 100); the KYC one shows "Reported 3 times" and the demo-bank scan; the QR one fires the `qr_pay_disguised_as_receive` hard signal.
- Benchmark on the first 50 cases, run after all polish (history, superseded as the headline by the combined result): accuracy 98.0%, scam recall 100% (26/26), false-positive rate 4.2% (1/24: g23, a genuine receipt screenshot judged Suspicious because "a screenshot cannot prove a payment"), scam type correct 100%, errors 0. Latency p50 4.5 s text, 7.4 s image, 11.8 s audio; p95 8.6 s text, 33.8 s image. Earlier runs: 96.0% / 100% / 8.3% (before the date fix), 98.0% / 100% / 4.2%.
- Browser checks on the live site: Trends data, Result page from Firestore without router state, Complaint page, Report dialog (up to the Google popup), share-target parking and prefill, 375 px audits of `/`, `/trends`, `/history`, `/about`, `/result/:id`, `/complaint/:id`.
- Deployed images (`api:6338ca4-dirty`, `linkscan:6338ca4-dirty`) were built from the working tree at that commit plus the polish edits that are now committed; source equals deployed. Redeploy with `bash scripts/deploy.sh all` if any doubt.

## 3. What is left

Owner only (an agent cannot do these)
1. Budget alert: `gcloud billing budgets create --billing-account=<BILLING_ACCOUNT_ID> --display-name="Scam Shield" --budget-amount=1000INR --filter-projects=projects/project-91260b43-6705-4176-b71 --threshold-rule=percent=0.5 --threshold-rule=percent=0.9 --threshold-rule=percent=1.0` (or Billing > Budgets & alerts).
2. Test a real Google sign-in and report on the live site (count 3 to 4), and the Android share menu and install on a real phone.
3. Record the demo video (`docs/submission/video-script.md`), upload it, and put the link in `README.md` (placeholder "add link before submitting") and deck slide 14.
4. Build the deck on the organisers' template (`docs/submission/deck-outline.md`, screenshots in `docs/submission/screenshots/`), export a PDF under 5 MB. Verify the cost slide in the billing console (estimates only).
5. Fill and submit the form (`docs/submission/description.md`).
6. Optional: delete `HANDOFF.md` and this file before submitting if you prefer a leaner repo. They contain no secrets and no private data (scrubbed 18 Oct); git history is unchanged.

Agent-doable, optional
- Run the 18 skipped Firestore tests: they need `FIRESTORE_EMULATOR_HOST` and Java (not installed on this Mac; `/usr/bin/java` is a stub). `firebase emulators:exec --only firestore --project demo-scam-shield "npm test -w api"` once a JDK exists. They passed on the owner's Windows machine earlier (see `docs/handoff/sdd-ledger.md`).
- Run `gemini.live.test.ts` (live Gemini; needs credentials via env, see the file header).
- Run the benchmark in Hindi (`npx tsx eval/run.ts --lang hi`) and add a table if wanted.
- Investigate the unexplained single run where a shared check finished (HTTP 200) but the page stayed on `/`: not reproduced in jsdom (a unit test passes) or in two later live runs, and the suspected cause (parallel runs and 429s) was never confirmed. Test the share flow on a real phone first.
- Re-enable Google Search grounding if the project quota is raised (`GEMINI_SEARCH=true`), then re-run the benchmark sequentially.
- Hardening ideas: Firebase App Check; per-IP limiter can be bypassed by calling `run.app` directly (per-user 30/day and global 3000/day caps still bind).

## 4. Known risks

- Gemini latency varies (4 to 40 s); the image p95 in the last run was 33.8 s. Run every video example once beforehand.
- Search grounding is off, so link checks rely on the model's own knowledge plus the isolated link scan.
- Only 185 benchmark cases (a few of them media), all synthetic and written by the authors: a sanity check, not a guarantee.
- Anonymous auth is free to mint; the global daily cap (3000 checks) bounds Gemini spend.

## 5. Summary of the last two responses given to the owner (pointers)

Response A: "Is the app fully done and all tested?" (an honest audit)
- Everything on the plan was built, deployed and pushed; typecheck and all runnable tests passed; live smoke, pages, PWA files and the demo site returned 200.
- Not verified: real Google sign-in and report, Android share and install, browser voice recording, the 18 Firestore emulator tests (no Java), the live-Gemini test file, dark mode.
- Not done at that time: redacting stored QR and link-scan text, a reload on stale chunks, link-preview tags, Playwright bump, prompt wording ("opened safely").
- Known risks: Gemini latency 4 to 40 s, search grounding off, direct `run.app` calls can spoof the per-IP limiter, synthetic benchmark.
- Owner to-do list: video link, deck, recording, budget alert, optional deletion of `HANDOFF.md` and this file, one real Google report test.

Response B: polish finished, then final benchmark and merge
- All polish items above were finished with tests, deployed (api, web, linkscan), smoke and examples passed, real link scans passed 12/12 sequentially.
- Benchmark at that time (first 50 cases only): accuracy 98.0%, recall 100%, false-positive rate 4.2%, 0 errors; text p50 4.5 s, image p50 7.4 s (p95 33.8 s), audio 11.8 s.
- Docs updated with the final numbers; `build` pushed and `main` fast-forwarded to the same commit (default branch shows README and code).
- Still unchecked: the items under "Not verified" in Response A, plus the unexplained single share-target run.

## 6. Useful commands

```bash
export PATH=/opt/homebrew/share/google-cloud-sdk/bin:$PATH   # gcloud on this Mac
npm test && npm run typecheck
bash scripts/deploy.sh all            # or: rules | api | linkscan | web
bash scripts/smoke.sh https://scam-shield-live.web.app
npx tsx eval/run.ts                   # sequential benchmark, about 8 minutes
npx tsx scripts/seed.ts               # idempotent demo data
npx tsx scripts/screenshots.ts        # regenerate deck screenshots from the live site
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="scam-shield-api" AND textPayload:"scam-shield:"' --project project-91260b43-6705-4176-b71 --freshness 15m
```

Log lines to know: `scam-shield: gemini_attempt_failed attempt=N kind=... status=...`, `scam-shield: analysis_failed`.
