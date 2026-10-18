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

**Headline: combined over three live runs, 185 synthetic cases** (90 scams, 90 genuine messages and 5 ambiguous inputs), written by the authors and sent one at a time to the live app. Ambiguous inputs are not scored as scam or genuine, so the metrics use the 180 scam and genuine cases; none of the 5 ambiguous inputs got a Scam verdict.

| Metric | Result |
|---|---|
| Accuracy | 98.3% (177 of 180 correct) |
| Scam recall (scams flagged) | 100% (90 of 90) |
| False-positive rate (genuine flagged) | 3.3% (3 of 90) |
| Scam type correct (among flagged scams) | 96.7% (87 of 90) |
| Latency, text | p50 4.5 s, p95 18.2 s |
| Errors | 0 |

The same numbers are shown, with a count-up effect, on the landing page of the live app. They are generated from the raw results by `npx tsx eval/aggregate.ts` (list of official runs: [`eval/results/official.json`](eval/results/official.json); full report: [`eval/results/combined.md`](eval/results/combined.md)).

| Run | Cases | Result |
|---|---|---|
| v1 (17 Oct) | 50 original cases (26 scams, 24 genuine; includes Hinglish text, a fake receipt, a QR trick, a voice note) | 100% accuracy, 100% recall, 0 false positives |
| v2 (18 Oct) | 35 harder cases (14 adversarial scams, 16 look-alike genuine messages, 5 ambiguous) | 33 of 35 correct; every scam flagged, 2 false positives |
| v3 (18 Oct) | 100 new cases (50 realistic scams over all 13 types, 50 realistic genuine messages), nothing tuned after seeing results | 99 of 100 correct; 100% recall, 1 false positive |

**The three false positives, plainly:** a scam-awareness forward that quotes a scam link (`l03`, rated Scam); a courier update with a tracking link (`l08`, Suspicious); a friend asking to borrow Rs 3,000 (`v3g40`, Suspicious). Scams were never missed in 90 of 90, but genuine messages can be over-flagged, so a "Suspicious" result is a prompt to check, not a finding.

**Baseline.** A keyword-only detector (`eval/baseline.ts`, about 30 patterns, text only) scored the same 94.1% as Gemini on the v2 text cases, with different mistakes (it rated four terse scams only Suspicious). On the larger v3 text set it scored 84.0% accuracy and 72.0% scam recall, against Gemini's 99.0% and 100% (see [`eval/results/run-v2.md`](eval/results/run-v2.md) and [`run-v3.md`](eval/results/run-v3.md)). On textbook scams a keyword filter already does well, which is why the first 50 cases overstate what the model adds.

**History.** The first run exposed a real bug (the model did not know today's date and flagged 2026 dates as "in the future"); it is fixed and the earlier result is kept in `eval/results/run1-before-date-fix.md`. An earlier run on `gemini-3.8-flash` scored 98.0% accuracy, 100% recall and 4.2% false positives on the first 50 cases, with image checks up to 34 s (`eval/results/run-gemini-3.8-flash.md`); that model was slow and sometimes rate-limited on this project, so the default is now `gemini-3.7-flash` with a fallback. The first 50-case run ([`eval/results/latest.md`](eval/results/latest.md)) and the same 50 cases with the interface in Hindi (100% accuracy, 100% recall, 0% false positives, `eval/results/run-hindi.md`) remain valid history, but cover only those first 50 cases.

**Honest limits.** All cases are synthetic, written by the authors and small in number, with few images and one voice note. A few cases (the demo examples, such as the fake KYC message and the QR case) contain identifiers that are also seeded in the demo scam list, so those are partly list-assisted. We tuned the prompt and settings while working with the v1 cases, so v1 is not a held-out test; the run reports for v2 and v3 state that nothing was tuned after seeing their results. Each run is a single pass without confidence intervals; with 180 scored cases one case is about 0.6 percentage points. Treat the numbers as a sanity check, not a guarantee. Method: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#evaluation-method).

**Rerun and test.**

```bash
npx tsx eval/run.ts --cases cases-v3.jsonl --gap 2500 --out run-v3   # live run (sequential, paced)
npx tsx eval/aggregate.ts            # regenerate combined.md and web/src/benchmark.generated.json
npx tsx eval/aggregate.ts --check    # verify only
npm test                             # includes eval/aggregate.test.ts, eval/metrics.large.test.ts (up to 100k synthetic rows)
                                     # and web/src/benchmark.test.ts, which fails if the landing page drifts from the raw results
```

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
| `eval/` | Benchmark cases (185 in three sets), harness, and results |
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
npx tsx eval/run.ts            # the first 50-case benchmark (sequential, paced); see Evaluation for v2 and v3
```

Important settings (API environment): `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`, `GEMINI_LOCATION`, `GEMINI_THINKING_LEVEL` (default LOW), `GEMINI_SEARCH` (default off), `TRUSTED_PROXY_HOPS` (2 behind Firebase Hosting), `LINKSCAN_URL`, `STORAGE_BUCKET`.

## Known limits

- English and Hindi only; no native app or SMS interception.
- Gemini latency varies (typically 4 to 20 s); on this project Google Search grounding hit quota limits, so it is off by default.
- The shared scam list is only as good as its reports; demo data is included for the examples (see the note on the Trends page).
- More limits (prompt injection, privacy, abuse limits, link-scan scope) are listed in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#known-limits).
