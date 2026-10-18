# Scam Shield

**Check a suspicious message, screenshot, QR code, link or voice note before you act on it.** Built for people in India, in English and Hindi (Hinglish understood).

- **Live app:** https://scam-shield-check.web.app (the original URL https://project-91260b43-6705-4176-b71.web.app serves the same app and also works)
- **Demo video:** _add link before submitting_
- **Fictional demo bank page (used by the examples):** https://bnb-kyc-update.web.app

Built for the AI Builder Cup, track *BFSI: Intelligent Risk, Fraud & Financial Experiences*, on **Gemini on Vertex AI, Firestore, Firebase (Auth, Hosting, Storage) and Cloud Run**.

## What it does

You paste or share something suspicious. Scam Shield returns:

- a verdict: **Scam**, **Suspicious** or **No scam signs found** (it never says "safe"), with a risk score and scam type;
- the red flags, each tied to evidence quoted from your input, and what to do next;
- for scams: a **complaint draft** for 1930 / cybercrime.gov.in, a one-tap way to add the scammer's phone number, UPI ID or website to a **shared scam list** ("Reported N times", linked identifiers), and a **warning card** to share on WhatsApp.

It analyses the content itself, so it can catch a scam nobody has reported yet, and it understands UPI-specific inputs:

| Input | What happens |
|---|---|
| Text (SMS, WhatsApp, email) | Gemini reads it; phone numbers, UPI IDs and domains are looked up in the shared scam list |
| Screenshot | Gemini reads the image (for example a fake "payment successful" receipt with an impossible date) |
| QR code | Decoded on the server; a QR that asks you to **pay** while the text says you will **receive** is a hard scam signal |
| Link | Opened in an isolated, private browser service; the final address, redirects, page text and a screenshot are shown, never opened on your phone |
| Voice note | Gemini transcribes (Hindi, English, Hinglish) and analyses it, for example a "digital arrest" call |

Also: public **Trends** page, per-person **History**, one-click **examples** for first-time visitors, an installable app that appears in Android's **share menu**, and **WebMCP** tools (`check_message`, `report_scam`) for in-browser AI agents.

## How Google services are used

- **Gemini on Vertex AI** (`gemini-3.7-flash`, with `gemini-2.5-flash` as an automatic fallback): one multimodal call per check returns a schema-validated verdict (structured JSON output) for text, images and audio, including audio transcription and the link-scan screenshot. Hard signals from our own checks can only raise a verdict, never lower it. If the first attempt is slow or rate-limited, the retry goes to the fallback model, which has its own quota. Google Search grounding is built in but switched off by default (see `GEMINI_SEARCH`) because of project quota.
- **Cloud Run:** `scam-shield-api` (public API, Hono on Node) and `scam-shield-linkscan` (a private Playwright/Chromium service that opens suspicious links in isolation, with a validating proxy, DNS pinning and its own zero-role service account).
- **Firestore:** `checks` (a person's own results), `entities` (the shared scam list: phones, UPI IDs, domains, accounts, with report counts and links between identifiers), `reports`, `stats` (public daily trend counters) and `usage` (per-user and global daily limits). Clients can read only their own checks and the public stats; everything else is server-only.
- **Firebase:** Authentication (anonymous for checks, Google sign-in to report), Hosting (the web app and the `/api/**` rewrite to Cloud Run, plus the demo-bank site), Storage (uploads, which a lifecycle rule deletes after 7 days; see Privacy for what is kept longer).

## Architecture

```mermaid
flowchart LR
  U[Browser / installed app] -->|static app| H[Firebase Hosting]
  U -->|/api/** rewrite| A[Cloud Run: scam-shield-api]
  U -->|upload screenshot or audio| S[(Firebase Storage, uploads expire after 7 days)]
  U <-->|sign-in| F[Firebase Auth: anonymous + Google]
  A -->|verify ID token| F
  A -->|read upload| S
  A -->|private call, IAM-only| L[Cloud Run: scam-shield-linkscan<br/>isolated Chromium]
  A -->|verdict, structured JSON| G[Gemini on Vertex AI]
  A <-->|scam list, checks, reports, stats, limits| D[(Firestore)]
  U -->|read own checks + public trends| D
  L -->|validated proxy only| W[(the suspicious website)]
```

One check: the app sends the text or an uploaded file path to the API. The API verifies the user, applies per-user, per-IP and global limits, extracts phone numbers, UPI IDs, links and QR content, looks identifiers up in the scam list, scans any link in the isolated service, then asks Gemini for the verdict. Scam-list hits and QR-pay-versus-receive mismatches can raise the verdict. Text is sent to Gemini as written and stripped of OTPs, card, Aadhaar and PAN numbers before it is stored. A step-by-step walkthrough, the trust boundaries and the known limits are in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Evaluation

50 synthetic cases (26 scams covering all 13 scam types, including Hinglish text, a fake receipt, a QR trick and a voice note; 24 genuine messages such as bank alerts, OTPs that say "do not share", delivery updates and a real payment receipt), written by the authors, and run one at a time against the live app:

| Metric | Result |
|---|---|
| Accuracy | 100.0% (50 of 50 verdicts correct) |
| Scam recall (scams flagged) | 100% (26 of 26) |
| False-positive rate (genuine flagged) | 0.0% (0 of 24) |
| Scam type correct (among flagged scams) | 100.0% (26 of 26) |
| Latency, text | p50 4.5 s, p95 20.8 s |
| Latency, image / audio | p50 7.3 s / 10.3 s (image p95 8.7 s) |

Details, cases and raw results: [`eval/`](eval/) and [`eval/results/latest.md`](eval/results/latest.md). The first run exposed a real bug (the model did not know today's date and flagged 2026 dates as "in the future"); it is fixed and the earlier result is kept in `eval/results/run1-before-date-fix.md`. The cases are synthetic, small and written by us, and a few of them (the demo examples, such as the fake KYC message and the QR case) contain identifiers that are also seeded in the demo scam list, so those are partly list-assisted. We also tuned the prompt and settings while working with these same cases, so this is not a held-out test. Treat the numbers as a sanity check, not a guarantee. How the benchmark is run and its limits are described in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#evaluation-method). An earlier run on `gemini-3.8-flash` scored 98.0% accuracy, 100% recall and 4.2% false positives, with image checks up to 34 s (kept in `eval/results/run-gemini-3.8-flash.md`); that model was slow and sometimes rate-limited on this project, so the default is now `gemini-3.7-flash` with a fallback. With only 50 cases the difference between 98% and 100% is a single case. The same 50 cases run with the interface in Hindi also scored 100% accuracy, 100% recall and 0% false positives, with no errors (`eval/results/run-hindi.md`).

**Eval v2 (harder, 35 new cases, live API):** 33 of 35 correct. All 14 adversarial scams were flagged, including English and Hinglish prompt injection and a disguised QR code, but 2 of 16 genuine look-alikes were wrongly flagged: a scam-awareness forward that quotes a scam link, and a courier tracking link. A keyword-only baseline scored the same 94.1% on text, with different mistakes (it rated four terse scams only Suspicious), so the first 50 cases overstate how much the model adds on easy inputs. The cases are written by the authors and small, so this is a sanity check, not a guarantee. Cases, baseline and raw results: [`eval/cases-v2.jsonl`](eval/cases-v2.jsonl), [`eval/baseline.ts`](eval/baseline.ts), [`eval/results/run-v2.md`](eval/results/run-v2.md).

## Privacy and safety

- Guidance only: every result says so and points to **1930** and cybercrime.gov.in. "No scam signs found" is never a promise.
- What you send is processed by Gemini on Vertex AI as written, **before** any redaction. OTP, CVV and PIN numbers, card numbers, Aadhaar and PAN numbers are blanked in the text before a check is stored (pattern-based, so it can miss things); the scammer's own phone, UPI ID and links stay readable.
- Storage: the lifecycle rule in [`scripts/storage-lifecycle.json`](scripts/storage-lifecycle.json) deletes files under `uploads/` (your screenshots and voice notes, stored as uploaded) after 7 days. It does **not** cover two other folders: link-scan screenshots (`screenshots/`) and the copy of an uploaded file that is kept under `reports/` when you report a scam. Stored check results in Firestore (redacted) have no automatic expiry configured in this repository.
- Reports on the scam list carry no name, email or user ID in the report record, and the public list shows only masked identifiers and counts. The server keeps a private record of which user already reported an identifier so that one person cannot count twice.
- Scam-list wording is "Reported N times", never "confirmed scammer". A single report cannot make a scam verdict on its own.
- Link scanning is isolated and private: every request and redirect hop goes through a validating proxy that blocks private and internal addresses; the scanner has no cloud permissions. See [`linkscan/SECURITY.md`](linkscan/SECURITY.md).
- All names, numbers and IDs in examples and tests are fictional ("Bharat National Bank").

## Provenance

Scam Shield was designed and built for the AI Builder Cup (first commit 16 Oct 2026; the history is in this repository). Some general-purpose front-end building blocks (basic UI components, the app shell and the toast setup) were adapted from the author's own earlier personal project; the product itself (the AI pipeline, scam list, QR and link handling, the isolated link scanner, reporting and complaint flows, evaluation and deployment) was written during the hackathon. *(Owner: confirm this wording is accurate before submitting.)*

## Repository layout

| Path | What |
|---|---|
| `web/` | React 18 + Vite + Tailwind PWA (Firebase Hosting) |
| `api/` | Hono API on Cloud Run: extraction, redaction, QR decode, Gemini, scam-list store |
| `linkscan/` | Isolated Playwright link scanner on Cloud Run |
| `shared/` | Types, schema, masking and complaint template used by web and api |
| `eval/` | 50-case benchmark and results |
| `scripts/` | Deploy, smoke test, example-asset generators, seed data, screenshots |
| `docs/` | [Architecture for judges](docs/ARCHITECTURE.md), design, plan, setup notes, submission material, screenshots |

## Run it yourself

```bash
npm install
npm test                 # all workspaces
npm run typecheck
npm run build -w web
```

Deploying needs the Google Cloud and Firebase CLIs and access to the project:

```bash
bash scripts/deploy.sh all     # rules, linkscan, api, web
bash scripts/smoke.sh https://scam-shield-check.web.app
npx tsx eval/run.ts            # the benchmark (sequential, paced)
```

Important settings (API environment): `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`, `GEMINI_LOCATION`, `GEMINI_THINKING_LEVEL` (default LOW), `GEMINI_SEARCH` (default off), `TRUSTED_PROXY_HOPS` (2 behind Firebase Hosting), `LINKSCAN_URL`, `STORAGE_BUCKET`.

## Known limits

- English and Hindi only; no native app or SMS interception.
- Gemini latency varies (typically 4 to 20 s); on this project Google Search grounding hit quota limits, so it is off by default.
- The shared scam list is only as good as its reports; demo data is included for the examples (see the note on the Trends page).
- More limits (prompt injection, privacy, abuse limits, link-scan scope) are listed in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#known-limits).
