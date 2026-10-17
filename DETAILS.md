# DETAILS: what was done, what is left, tests and results

Written for the next agent. State as of 17 Oct 2026. Companion docs: `HANDOFF.md` (original handoff plus findings), `docs/setup-notes.md` (cloud facts, deploy and hardening notes), `eval/results/latest.md` (benchmark), `README.md` (public description).

- Repo (public): https://github.com/Namans12/scam-shield. Branches `build` and `main` are at the same commit; **`main` is the default branch and is what judges see**. Work on `build`, then fast-forward `main` (`git checkout main && git merge --ff-only build && git push origin main`).
- Live app: https://project-91260b43-6705-4176-b71.web.app . Demo bank page: https://bnb-kyc-update.web.app . GCP project `project-91260b43-6705-4176-b71`, region `asia-south1`.
- Hackathon deadline: 18 Oct 2026, 23:59 IST (aim to submit by about 20:00 IST). Freeze deploys about 14:00 IST on the 18th.

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

Gemini reliability (the biggest finding; details in `HANDOFF.md` section 10)
- Cause of `analysis_failed` on checks that contain a link: those inputs attach Google Search grounding, which on this project returns 429 after about 4 calls and sometimes hangs 40 s or more.
- Shipped: thinking level `LOW` by default (about 3x faster; `GEMINI_THINKING_LEVEL`), first attempt capped at 15 s and total at 40 s, one retry that always drops search, failure cause logged (`gemini_attempt_failed attempt=N kind=... status=...`, no user content), and `GEMINI_SEARCH` switch (**default off**; deploy with `GEMINI_SEARCH=true` to enable).
- Result: 16 of 16 link and plain checks passed sequentially (5 to 16 s) after search was turned off, then 12 of 12 more after the final deploy.

Task 15, 16, 17, 18, 19
- 15: Hindi checked on all examples (summary, flags, steps in Hindi); 375 px audit of every page (no horizontal overflow; About links fixed); 12 screenshots in `docs/submission/screenshots/` (`npx tsx scripts/screenshots.ts` regenerates them from the live site).
- 16: `eval/` harness: 50 synthetic cases (`cases.jsonl`, 26 scam and 24 genuine, all 13 scam types, 2 Hinglish, the 4 examples, 2 genuine images made by `eval/make-assets.ts`), `metrics.ts`, `run.ts` (sequential, paced to the API's 10 checks per minute per IP, fresh anonymous user per 25 cases, writes `eval/results/*.raw.json` and `latest.md`). The first run exposed a real bug (the model did not know today's date and flagged 2026 dates as "future"); fixed in `buildVerdictPrompt`. Run 1 is kept in `eval/results/run1-before-date-fix.md`.
- 17: X-Forwarded-For measured: 2 entries through Hosting (client plus Google front end), Hosting overwrites a forged header, so `TRUSTED_PROXY_HOPS=2` is right; direct `run.app` calls can spoof the per-IP limiter key (per-user and global caps still apply). API minScale 1; linkscan private (403 unauthenticated), `run.invoker` only for the API service account. Smoke x3 a minute apart all OK.
- 18: WebMCP tools `check_message` and `report_scam` (`web/src/webmcp/`), registered through `navigator.modelContext` (`registerTool`, falling back to `provideContext`). Loaded and executed against the live site with a stub context.
- 19: `README.md`, `docs/submission/description.md` (245 words), `video-script.md`, `deck-outline.md`.

## 2. Tests and results (latest, 17 Oct)

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
- Benchmark, final run after all polish (`eval/results/latest.md`): accuracy 98.0%, scam recall 100% (26/26), false-positive rate 4.2% (1/24: g23, a genuine receipt screenshot judged Suspicious because "a screenshot cannot prove a payment"), scam type correct 100%, errors 0. Latency p50 4.5 s text, 7.4 s image, 11.8 s audio; p95 8.6 s text, 33.8 s image. Earlier runs: 96.0% / 100% / 8.3% (before the date fix), 98.0% / 100% / 4.2%.
- Browser checks on the live site: Trends data, Result page from Firestore without router state, Complaint page, Report dialog (up to the Google popup), share-target parking and prefill, 375 px audits of `/`, `/trends`, `/history`, `/about`, `/result/:id`, `/complaint/:id`.
- Deployed images (`api:6338ca4-dirty`, `linkscan:6338ca4-dirty`) were built from the working tree at that commit plus the polish edits that are now committed; source equals deployed. Redeploy with `bash scripts/deploy.sh all` if any doubt.

## 3. What is left

Owner only (an agent cannot do these)
1. Budget alert: `gcloud billing budgets create --billing-account=01F164-CA107B-D85742 --display-name="Scam Shield" --budget-amount=1000INR --filter-projects=projects/project-91260b43-6705-4176-b71 --threshold-rule=percent=0.5 --threshold-rule=percent=0.9 --threshold-rule=percent=1.0` (or Billing > Budgets & alerts).
2. Test a real Google sign-in and report on the live site (count 3 to 4), and the Android share menu and install on a real phone.
3. Record the demo video (`docs/submission/video-script.md`), upload it, and put the link in `README.md` (placeholder "add link before submitting") and deck slide 14.
4. Build the deck on the organisers' template (`docs/submission/deck-outline.md`, screenshots in `docs/submission/screenshots/`), export a PDF under 5 MB. Verify the cost slide in the billing console (estimates only).
5. Fill and submit the form (`docs/submission/description.md`).
6. Optional: delete `HANDOFF.md` (and this file) before submitting if the project ID and URLs should not be public. None of it is secret.

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
- Only 50 benchmark cases (5 of them media), all synthetic: a sanity check, not a guarantee.
- Anonymous auth is free to mint; the global daily cap (3000 checks) bounds Gemini spend.
- Off-limits (from the handoff): `Namans12/stocks` (real statements), `Personal-Money-Manager` (leaked Atlas password in history; rotate it), project `coral-mile-t3tp7`.

## 5. Summary of the last two responses given to the owner (pointers)

Response A: "Is the app fully done and all tested?" (an honest audit)
- Everything on the plan was built, deployed and pushed; typecheck and all runnable tests passed; live smoke, pages, PWA files and the demo site returned 200.
- Not verified: real Google sign-in and report, Android share and install, browser voice recording, the 18 Firestore emulator tests (no Java), the live-Gemini test file, dark mode.
- Not done at that time: redacting stored QR and link-scan text, a reload on stale chunks, link-preview tags, Playwright bump, prompt wording ("opened safely").
- Known risks: Gemini latency 4 to 40 s, search grounding off, direct `run.app` calls can spoof the per-IP limiter, synthetic benchmark.
- Owner to-do list: video link, deck, recording, budget alert, optional `HANDOFF.md` deletion, one real Google report test.

Response B: polish finished, then final benchmark and merge
- All polish items above were finished with tests, deployed (api, web, linkscan), smoke and examples passed, real link scans passed 12/12 sequentially.
- Final benchmark on the live deploy: accuracy 98.0%, recall 100%, false-positive rate 4.2%, 0 errors; text p50 4.5 s, image p50 7.4 s (p95 33.8 s), audio 11.8 s.
- Docs updated with the final numbers; `build` pushed and `main` fast-forwarded to the same commit (default branch shows README and code).
- Still unchecked: the items under "Not verified" in Response A, plus the unexplained single share-target run.

## 6. Useful commands

```bash
export PATH=/opt/homebrew/share/google-cloud-sdk/bin:$PATH   # gcloud on this Mac
npm test && npm run typecheck
bash scripts/deploy.sh all            # or: rules | api | linkscan | web
bash scripts/smoke.sh https://project-91260b43-6705-4176-b71.web.app
npx tsx eval/run.ts                   # sequential benchmark, about 8 minutes
npx tsx scripts/seed.ts               # idempotent demo data
npx tsx scripts/screenshots.ts        # regenerate deck screenshots from the live site
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="scam-shield-api" AND textPayload:"scam-shield:"' --project project-91260b43-6705-4176-b71 --freshness 15m
```

Log lines to know: `scam-shield: gemini_attempt_failed attempt=N kind=... status=...`, `scam-shield: analysis_failed`.
