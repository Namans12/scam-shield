# Scam Shield — Handoff (state as of 2026-10-16 16:49 IST)

Hackathon: **AI Builder Cup**, track **BFSI: Intelligent Risk, Fraud & Financial Experiences**.
**Hard deadline: 18 Oct 2026, 23:59 IST** (aim to submit by ~20:00 IST on the 18th). Deploy freeze planned ~14:00 IST on the 18th.
Owner: Naman (GitHub `Namans12`, Google account `namans1201@gmail.com`). Working solo with Claude.

This file is meant to let another agent/system continue without the original conversation. Read it top to bottom, then read the three source-of-truth docs listed in §2.

---

## 1. What we are building

**Scam Shield** — a web app (installable PWA) where anyone in India can check a suspicious **text, screenshot, QR code, link or voice note**. Gemini analyses it and returns a verdict (**Scam / Suspicious / No scam signs found** — the app never says "safe"), the red flags with evidence quoted from the input, and next steps, in **English or Hindi** (Hinglish input understood). After a scam verdict the user can: draft a **1930 / cybercrime.gov.in complaint**, add the scammer's identifiers (phone, UPI ID, domain, account) to a **shared scam list** in Firestore (so the next person is warned: "Reported N times", linked identifiers), and share a **warning card** to WhatsApp. Plus a public **trends** page, **history**, one-click **example scams** for judges, and (optional, cut first) WebMCP agent tools.

Why this idea / positioning (for the deck): ₹19.8k crore reported cyber-fraud losses in 2025 (I4C), victims recover ~2%. Truecaller Scam Checker (Sep 2026) and Google's scam detection (Pixel-only) match reported links/numbers/text; Scam Shield **analyses the content itself** (catches unreported scams), handles **UPI-specific inputs** (QR → UPI ID, fake payment screenshots), **Hinglish voice notes**, **safe link scanning** in an isolated browser, and turns a verdict into **action** (complaint draft + shared list + family warning).

Required Google tech (judges check the submission description): **Gemini on Vertex AI, Firestore, Firebase (Auth, Hosting, Storage), Cloud Run.** All four are in use.

## 2. Source-of-truth documents (read these)

| File | What it is |
|---|---|
| `docs/superpowers/specs/2026-10-16-scam-shield-design.md` | Approved design (goals, non-goals, anti-goals, architecture, data model, screens, schedule). |
| `docs/superpowers/plans/2026-10-16-scam-shield.md` | Approved 20-task build plan (Tasks 0–19), global constraints, review focus. **Tasks 12–19 are still to do.** |
| `docs/setup-notes.md` | GCP/Firebase facts, URLs, Gemini model test results, deploy notes. |
| `docs/handoff/sdd-ledger.md` | Full execution ledger: every task's commits, review verdicts, rulings, deferred minor findings (copy of the git-ignored `.superpowers/sdd/…/progress.md`). |
| `linkscan/SECURITY.md` | Link-scanner threat model and compensating controls. |

## 3. Repo and branches

- Local: `D:\builder-cup` (Windows, Git Bash/PowerShell). Public repo: **https://github.com/Namans12/scam-shield**.
- Working branch: **`build`** (never work on `main`). Latest commit: `4cd8c6d fix(web): upload deadline and cancel, camera button, QR amount and drop-zone polish`.
- **⚠️ Nothing after the first scaffold commit is pushed.** `origin/build` is still at `e971b73`; `main` has only the docs commits. Run `git push origin build` (and later merge/push `main`) — the submission requires the public repo to contain the code. The owner has not yet approved pushing.
- **Uncommitted changes in the working tree** (left by the Task 10 agent that was stopped mid-run): `scripts/smoke.sh` (modified), `storage.rules` (modified — intended fix: audio `<= 15 MB`, image `<= 10 MB`, owner-read for `screenshots/{uid}/…`), `scripts/http.mjs` (new), `.firebase/` (untracked cache; should be git-ignored). **Review `git diff`, finish/validate, then commit** — and the corrected `storage.rules` has probably NOT been deployed yet.
- Monorepo (npm workspaces): `shared/` (types, zod schema, mask, complaint — consumed as TS source), `api/` (Hono on Cloud Run), `linkscan/` (Playwright service on Cloud Run, private), `web/` (React 18 + Vite + Tailwind v4 PWA, UI kit copied from the owner's Spotlight app), `eval/` (placeholder, Task 16).
- Tests: `npm test` (workspaces), `npm run typecheck`. Last known: api 233 pass (+18 skipped emulator/live), web 133 pass, linkscan 93 pass, shared 14 pass. Build: `npm run build -w web` OK (main chunk ~63 kB gz; Firestore/Storage lazy chunks).

## 4. Cloud state (project `project-91260b43-6705-4176-b71`, number 494852004380, region `asia-south1`)

**Live and responding at handoff time:**
- Web (Firebase Hosting): **https://project-91260b43-6705-4176-b71.web.app** → `/` 200, `/api/health` → `{"ok":true}`.
- API (Cloud Run `scam-shield-api`, public, gen2, 1 CPU/1 GiB, min 1/max 5): https://scam-shield-api-2dpycjnpeq-el.a.run.app
- Link scanner (Cloud Run `scam-shield-linkscan`, **private**, gen2, 2 CPU/2 GiB, concurrency 4, min 0/max 3, runs as dedicated zero-role SA `linkscan-sa@…`; `run.invoker` granted only to the API's SA).
- Firestore (native, asia-south1) with rules + composite index `checks(uid asc, createdAt desc)`; Storage bucket `project-91260b43-6705-4176-b71.firebasestorage.app` with rules + 7-day lifecycle on `uploads/`; Artifact Registry repo `scam-shield`; Auth: Anonymous + Google enabled.
- Gemini: model `gemini-3.8-flash`, location `global`, combined JSON-schema + Google Search grounding works (~13 s with search, ~5 s without). Fallback `gemini-3.7-flash` two-call path.
- Firebase web config is public and committed in `web/.env.production`.

**Unknown / not verified (the deploy agent was stopped before reporting):**
- Whether the **deployed API/web images are the latest commits** (images were built by Cloud Build from the working tree, tags may be `-dirty`). Redeploy before submission: `bash scripts/deploy.sh all`.
- Result of `scripts/smoke.sh` end-to-end through Hosting (a real check with Gemini + link scan). **Run it** and fix whatever fails.
- Link scanner Chromium sandbox: not yet determined whether the sandbox works on Cloud Run gen2. Deployed **without** `LINKSCAN_NO_SANDBOX`; if every scan returns `scan_failed`, redeploy with `LINKSCAN_NO_SANDBOX=1`. Test with a real URL via the API.
- `X-Forwarded-For` hop count through Hosting → Cloud Run (the per-IP limiter assumes `TRUSTED_PROXY_HOPS=2`). A temporary `DEBUG_XFF=1` env flag exists on `/api/health` for measuring (default off; keep off).

**Resources/IAM created by the build (all in this project):**
- Cloud Run services above; service account `linkscan-sa` (no roles); Artifact Registry repo `scam-shield`; Cloud Build staging bucket `project-91260b43-6705-4176-b71_cloudbuild`; Firebase web app `scam-shield-web` (appId `1:494852004380:web:b1c5bafffa9aa58d631dd9`).
- Default compute SA (`494852004380-compute@developer.gserviceaccount.com`, API runtime + Cloud Build identity) has: `aiplatform.user`, `datastore.user`, `storage.objectAdmin`, `run.invoker`, `firebaseauth.viewer`, **plus (granted 16 Oct, Ruling R12)** `artifactregistry.writer` on the repo and `logging.logWriter` project-wide.
- Do NOT use project `coral-mile-t3tp7` (belongs to an organisation folder the owner can't administer; billing account isn't theirs).
- Billing: account `01F164-CA107B-D85742`. **Set a budget alert** (Task 17, owner action in console). Min-instance=1 on the API costs a little continuously.

**Auth/CLIs on the owner's machine:** `gcloud` at `C:\Users\naman\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud(.cmd)` (not on Git Bash PATH; output has `\r` — strip it), logged in as `namans1201@gmail.com` with ADC; `firebase` CLI logged in; `gh` logged in as `Namans12` (and `namans1201`). Local Docker daemon is not running — images are built with **Cloud Build** (`gcloud builds submit`, root `cloudbuild.yaml`). `curl` in this Git Bash errors with `-w` on some calls; Python urllib works.

## 5. Task status (plan Tasks 0–19)

| Task | Status | Notes |
|---|---|---|
| 0 Cloud setup | ✅ done | Firebase attached by owner in console; Google provider enabled by owner. |
| 1 Scaffold | ✅ reviewed | |
| 2 shared types/mask/complaint | ✅ reviewed | |
| 3 extract + redact | ✅ reviewed (3 fix rounds) | OTP/CVV redaction redacts **every** candidate number near a label; kept identifiers masked first. |
| 4 QR decode + UPI parse | ✅ reviewed (1 fix round) | bounded memory (1600×1600, 50 MP). |
| 5 Gemini model/prompt/hard signals | ✅ reviewed | live test verified on real Gemini. |
| 6 Store (memory + Firestore) | ✅ reviewed | tested on Firestore emulator. |
| 7 API routes/pipeline | ✅ reviewed (1 fix round) | quota, XFF, redaction, hard-signal summaries fixed. |
| 8 Link scanner | ✅ reviewed (1 fix round) | validating proxy (Playwright doesn't route redirect hops), WebRTC disabled, jitless. |
| 9 Web shell + text check | ✅ reviewed (1 fix round) | lazy Firebase, subpath exports from shared. |
| 10 Deploy pipeline + first deploy | 🟡 **mostly done, unfinished** | rules/indexes/lifecycle + both services + Hosting are live; smoke test, sandbox finding, XFF finding, storage.rules fix deploy, setup-notes update **not confirmed**. Agent stopped by the owner's request. |
| 11 Uploads (image/QR/audio) | 🟡 built + fix round committed (`4cd8c6d`); **re-review was stopped**, not yet approved | review: fix verify stall-based 60 s upload deadline, Cancel button, abort on unmount, camera button, window drag guard. |
| 12 Example scams + demo phishing site + seed data | ✅ built, deployed, seeded (16 Oct, second machine) | Examples verified live: kyc_sms scam 98 ("Reported 3 times", demo-bank scan), qr_receive scam 98 (hard signal), digital_arrest scam 100, fake_payment scam 98 (one 502 `analysis_failed` at 31 s on first try, passed on 2 retries; API logs only the code, not the cause: add cause logging + one retry in the polish batch). Demo site: https://bnb-kyc-update.web.app (Hosting target `demo-bank`). Re-seed: `npx tsx scripts/seed.ts`. |
| 13 Reporting, complaint draft, share warning | ✅ built + web deployed (16 Oct) | Report dialog (Google link/sign-in, state, city), `/complaint/:id`, share card + WhatsApp fallback. UI verified live up to the Google popup; **owner to test a real Google sign-in + report (count 3 → 4)**. API side (`/api/report`) already existed. |
| 14 Trends, history, About, PWA share target | ⬜ not started | also Firestore read for `/result/:id`. |
| 15 Hindi pass + polish + screenshots | ⬜ not started | |
| 16 Evaluation harness (50 labelled cases) | ⬜ not started | needed for deck slide 12. |
| 17 Hardening + cost guards | ⬜ not started | budget alert is an owner action. |
| 18 WebMCP agent tools | ⬜ optional — **cut first** | cut order if late: Task 18, then voice notes. |
| 19 Submission package | ⬜ not started | README, description, deck, video script. |

### Polish batch (do after Task 13–14, before the freeze) — must-fix items first
From the ledger (details in `docs/handoff/sdd-ledger.md`):
1. **Must-fix (privacy):** `redact.ts` `CURRENCY_BEFORE` has no letter lookbehind — "Your OTP for orders 482913" / "OTP valid 2 hrs 482913" leak the OTP. Use `(?<![A-Za-z])(?:rs\.?|inr|rupees?)\s*$|₹\s*$` + tests.
2. **Must-fix (availability):** linkscan `closeAll` has no time limit — a wedged `context.close()` permanently consumes a scan slot (4 stuck ⇒ every scan 503). Add a timeout + `browser.close()`/reset fallback.
3. API: redact stored `qr` (raw/pn/tn) and `linkScan.title/text` via `redact()`; cap QR flag evidence length; apply `qr_receive_scam` when model type is `other` and the signal is QR.
4. Prompt polish (Task 5 minors): `\bwon\b(?!['’]t)`; widen Hindi/Hinglish receive-words (`मिलेंगे|milenge|जीत|jeet|इनाम|inaam|कैशबैक|रिफंड|जमा`); transcript/evidence stay in original language; add "what to look up / compare with official site" instruction when search is attached; wrap/cap QR payee name in grounding prompt; don't claim a screenshot is attached when it was dropped; reword "opened safely" (primes the forbidden word).
5. Web: char-limit note `aria-describedby`; PWA precache `globIgnores` for Firestore/Storage chunks; `vite:preloadError` → reload for stale chunks after a deploy; `og:image`/`og:url`.
6. Linkscan: bump Playwright + base image to 1.55.1; document iframe/popup WebRTC residual; fix SECURITY.md "2 renderer processes" claim; concurrency-cap test must not hit 8.8.8.8; deploy must pass `LINKSCAN_NO_SANDBOX=1` only if needed.
7. Storage rules: audio `<=` 15 MB, image ≤ 10 MB (already edited, **undeployed**), allow owner-read of `screenshots/{uid}/…`.

## 6. Key design decisions & rulings (so you don't re-litigate them)

- Verdicts: `scam | suspicious | no_signs`. **Never** use the word "safe"/"सुरक्षित" anywhere (enforced by tests in en and hi). Scam-list wording is "Reported N times" — never "confirmed scammer". Disclaimer on every result: "Guidance only. If you've lost money, call 1930 immediately."
- Hard signals can only **raise** a verdict: scam-list hit with ≥2 reporters ⇒ scam/85; 1 reporter ⇒ ≥ suspicious/60; QR that asks to PAY while text says receive ⇒ scam/85. When a hard signal raises a model `no_signs`, the API **replaces** the model summary with a localized note, adds a synthetic red flag + default next step (Ruling R11).
- Privacy: stored text is `redact()`-ed; Gemini's raw `entities` are filtered to vetted keys; `entities`, `reporters`, `reports`, `usage` are server-only (Admin SDK); `checks` are owner-readable; `stats/*` public; uploads auto-delete after 7 days; reports store no uid.
- Abuse/cost: 30 checks/uid/day, 3000/day global (global counter increments only when the uid is within limit), per-IP 10/min check + 60/min report (best-effort, fails open; XFF entry = `parts[len − TRUSTED_PROXY_HOPS]`, default 2), `bumpUsage` fails open, `/api/check` hard limit 45 s, link scan budget 12 s. Follow-up: Firebase App Check.
- Link scanner security (critical): all hops validated via a per-scan proxy with DNS pinning; WebRTC/WebTransport disabled; `--jitless`; V8 heap cap; zero-role SA; no VPC; private Cloud Run with invoker only for the API SA. Don't weaken. `--ingress=internal` was deliberately NOT used (Cloud Run→Cloud Run via run.app isn't internal without VPC egress).
- Images are built with Cloud Build, not local Docker (Ruling R8). Region `asia-south1` is supported for Hosting→Cloud Run rewrites (checked in docs).
- Spotlight (owner's own app, `C:\Users\naman\Desktop\Spotlight`) is the UI source; **no attribution needed** (owner's instruction). It was NOT submitted to the WebMCP Challenge (owner confirmed), but its README still reads like a submission note — reword if ever linked.
- Off-limits repos/data: `Namans12/stocks` (real brokerage statements — never publish), `Personal-Money-Manager` (earlier hackathon + leaked Atlas password in history; rotate it).

## 7. Working agreement with the owner

- **Models:** use **Sonnet 5.5 for implementation/fix subagents; Opus 5.5 only for planning and review** (owner's explicit instruction). Always pass `model` explicitly.
- Workflow used: superpowers **subagent-driven development** — per task: implementer (TDD, file-scoped commits) → Opus task review (spec + quality, with a scoped diff file) → fix rounds by resuming the implementer → scoped Opus re-review. Rulings are recorded in the ledger. Briefs/reports/diffs live in `.superpowers/sdd/2026-10-16-scam-shield/` (git-ignored scratch; `task-N-brief.md`, `task-N-report.md`, `review-*.diff`).
- Concurrency lessons: several implementers ran in parallel in one tree — they MUST `git add` only their own files (never `git add -A`/`.`), and never stage `.superpowers/`. `package-lock.json` gets touched by every `npm i`; regenerate with `npm install` if it conflicts.
- Owner-only actions (an agent cannot do these): browser logins, Firebase console toggles, billing/budget alert, recording the demo video, downloading the deck template as PPTX, filling and submitting the hackathon form.
- Ask the owner before: pushing to GitHub, deleting anything, broader IAM, anything that publishes publicly.

## 8. What remains, in suggested order

1. **Stabilise (tonight, 16 Oct):** inspect the uncommitted diff → commit; deploy `storage.rules`; `bash scripts/deploy.sh all`; run `bash scripts/smoke.sh https://project-91260b43-6705-4176-b71.web.app`; determine the Chromium sandbox setting by scanning a real URL; measure XFF hops; update `docs/setup-notes.md`; finish Task 11's re-review (or accept). Push `build` to GitHub (ask owner).
2. **17 Oct:** Task 12 (examples: fake KYC SMS with look-alike bank link, fake payment screenshot, QR "receive ₹5,000" that actually encodes a pay request, Hinglish "digital arrest" voice note via Cloud Text-to-Speech; fictional bank "Bharat National Bank"; demo phishing site on a second Hosting site `bnb-kyc-update`; seed scam list so "Reported 3 times" shows) → Task 13 (Google sign-in report flow, complaint page, WhatsApp share card) → Task 14 (trends, history, About, Android share target) → Task 15 → polish batch above.
3. **18 Oct AM:** Task 16 (eval: 50 labelled cases — 26 scams/24 genuine; report accuracy, scam recall, false-positive rate, latency; if FPR > 0.15 or recall < 0.85 tune the prompt once), Task 17, optional Task 18. **Freeze deploys ~14:00 IST.**
4. **18 Oct PM — Task 19 submission package:** README (what it is, live link, demo link, how Firebase/Firestore/Cloud Run/Gemini are used, architecture, eval table), ≤250-word description naming all four services, 16-slide deck on the organisers' template (exported PDF ≤ 5 MB; slide 12 = eval table, slide 11 = screenshots), 3:30 demo video (script in the plan), final smoke test, verify the repo is public and all links open in a private window, then the owner submits the form.

Submission checklist (organisers' rules): pitch deck PDF on the prescribed template · 3–4 min demo video (must show working functionality) · deployed prototype link (must stay up through evaluation — no retries) · public GitHub repo · brief description including how Firebase, Firestore, Cloud Run and Gemini are used.

## 9. Known risks

- Deployed code may lag the repo; nothing is pushed to GitHub yet.
- Link-scan on Cloud Run is unproven end-to-end (sandbox flag, Chromium memory on 2 GiB).
- Gemini quality on Hindi/Hinglish audio and screenshots is untested at scale — the eval harness (Task 16) is how we find out; keep example inputs rehearsed for the video.
- Anonymous auth is free to mint, so per-user limits are soft; the global daily cap (3000) bounds Gemini spend; set the billing budget alert.
- Truecaller/Google competition: the deck must lead with content analysis + UPI/QR/voice + actions, not "number lookup".
