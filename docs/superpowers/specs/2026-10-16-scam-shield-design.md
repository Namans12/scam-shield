# Scam Shield — Design

Date: 2026-10-16 · Author: Naman (with Claude) · Status: draft for approval

## 1. Intent and why

Scam Shield lets anyone in India check a suspicious message before they act on it. A user pastes or shares a text, a screenshot, a QR code, a link or a voice note. Gemini analyses it and returns a clear verdict, the specific red flags in plain English or Hindi, and what to do next. If it is a scam, the app drafts a ready-to-file cybercrime complaint, adds the scammer's phone number / UPI ID / website to a shared scam list so the next person is warned instantly, and gives the user a warning card to forward to family groups.

Why this, why now:

- Indians reported ₹19,813 crore of cyber-fraud losses across 21.8 lakh complaints in 2025 (I4C). Victims recover about 2%.
- Existing tools leave gaps. Truecaller's Scam Checker (Sep 2026) matches links/numbers/text against prior reports and does not take screenshots, QR codes or voice. Google's scam detection is mostly Pixel-only. Chakshu / Sanchar Saathi is a reporting form with no verdict.
- Scam Shield's angle: it **analyses the content itself** (so it can catch a scam nobody has reported yet), handles **UPI-specific inputs** (QR → UPI ID, fake "payment received" screenshots), **Hinglish voice notes**, **safely opens suspicious links**, and turns a verdict into **action** (complaint draft + shared list + family warning).

It is being built for the AI Builder Cup hackathon, **BFSI: Intelligent Risk, Fraud & Financial Experiences** track. Submission deadline: **18 Oct 2026, 11:59 PM IST**; target submission by ~8 PM IST that day. Beyond the hackathon, the owner wants it to be something real people keep using and a strong CV project.

## 2. Users

- **Primary:** anyone in India with a smartphone who receives something suspicious (SMS, WhatsApp, email, payment request, QR code, call). Design must work for both young and older users: plain words, large tap targets, no jargon.
- **Hackathon judges:** must be able to understand and try the product within a minute, with no sign-up and no need to bring their own scam content.

## 3. Goals

1. Check five kinds of input: **text, screenshots, QR codes, links, voice notes / call recordings**.
2. Return a verdict (Scam / Suspicious / No scam signs found), a risk score, the scam type, the red flags (each tied to evidence in the input), and next steps — in **English or Hindi** (Hinglish input understood).
3. After a scam verdict:
   - **Complaint draft** for the 1930 helpline / cybercrime.gov.in, pre-filled with evidence.
   - **Shared scam list**: phone numbers, UPI IDs, domains and bank accounts extracted from the input are saved; later checks containing any of them are warned instantly ("reported N times"), and identifiers that appear together are linked so one report flags its siblings.
   - **Share warning** card ready for WhatsApp.
   - **Scam trends** page: public view of most-reported scam types this week.
4. **Try an example** row with ready-made scams (fake KYC SMS, fake payment screenshot, QR "receive money" scam, fake police / "digital arrest" voice note) so judges never get stuck.
5. Installable on phones as a web app, appearing in Android's **share menu** (Web Share Target), so a user can share a WhatsApp message or image straight to Scam Shield.
6. Stay up and working throughout evaluation.
7. Produce real numbers for the deck's benchmarking slide (accuracy, false-positive rate, latency).
8. *If time allows (cut first):* expose `check_message` and `report_scam` as WebMCP tools so browser AI agents can use Scam Shield.

## 4. Non-goals

- Native Android/iOS apps, browser extension, SMS/call interception or blocking.
- Automatically filing complaints with the police or 1930 — we only draft; the user files.
- Languages beyond English and Hindi at launch.
- Misinformation / fake-news checking (possible later mode, not now).
- Payments, bank integrations, account aggregator data.

## 5. Anti-goals (failure even if it "works")

- Telling a user something is **safe** when it is a scam. The app never says "safe"; the best verdict is "No scam signs found" plus standard caution.
- The deployed link or an API being down when judges try it.
- Leaking or publicly exposing users' private messages, images or audio.
- The shared list being used to smear innocent numbers (fake mass reports, single-report "confirmed scammer" labels).
- Looking like a Truecaller clone. The pitch and UI lead with content analysis and actions, not a number lookup.
- Giving investment or legal advice.

## 6. Hard constraints

- Must visibly use **Gemini, Firestore, Firebase and Cloud Run** (submission rules); the brief description must say how each is used.
- Solo developer (with Claude), ~2.5 days.
- Owner has a GCP project with billing enabled.
- Deliverables besides the app: public GitHub repo, 16-slide deck on the prescribed template (PDF ≤ 5 MB), 3–4 min demo video, brief description.
- Copy/text from Spotlight is the owner's own work; reuse it without attribution.

### Submission rules (from the organisers)

- **Pitch deck** on the prescribed template, exported to PDF (≤ 5 MB). Template slides: 1 team details (team name, leader, problem statement) · 2 template note · 3 brief about the idea · 4 opportunities (how it differs, how it solves the problem, USP) · 5 features · 6 process flow / use-case diagram · 7 wireframes (optional) · 8 architecture diagram · 9 technologies · 10 estimated cost (optional) · 11 prototype snapshots · 12 performance report / benchmarking · 13 future development · 14 links (GitHub, demo video, live product) · 15–16 blank.
- **Demo video** 3–4 minutes showing working functionality; over-length may be penalised; an unconvincing demo stops the entry before prototype evaluation.
- **Deployed prototype** on GCP / Cloud Run that stays functional "throughout the evaluation process" (no end date given); no retries if anything is down.
- **Public GitHub repo** that stays accessible.
- **Brief description** including how Firebase, Firestore, Cloud Run and Gemini are used.

### Existing code to start from

- Spotlight (owner's app): local copy at `C:\Users\naman\Desktop\Spotlight`, also `github.com/Namans12/Spotlight`. Reuse UI kit, layout, rate limiting, guest-session flow, WebMCP tool pattern.
- Scraper-sdk: `github.com/namans1201/Scraper-sdk` (GitHub only, not on this machine). Reuse `apps/server/src/scraper.ts` (Playwright capture) and `extractor.ts` for the link scanner.

### Environment as of 16 Oct

- Node 22 and Docker are installed. **`gcloud` and `firebase` CLIs are not installed**; install them first, then the owner signs in (browser login) and the project ID is read with `gcloud projects list`.
- Setup goes at the very start: enable Cloud Run, Vertex AI, Firestore, Cloud Storage, Artifact Registry/Cloud Build APIs; add Firebase to the project; create Firestore.

## 7. Decisions made by the owner

| Topic | Decision |
|---|---|
| Track | BFSI |
| Name | Scam Shield |
| Users | Anyone (not elderly-only, not family-only) |
| Languages | English + Hindi (Hinglish understood) |
| Inputs | Text, screenshots & QR, links (safe visit), voice notes |
| After verdict | Complaint draft, shared scam list, share warning, trends page |
| Sign-in | Checking needs no sign-in; adding to the scam list needs Google sign-in |
| Agent tools | Yes if time allows |
| Cut order if late | 1st agent tools, 2nd voice notes |
| Examples | Yes, one-click examples |
| UI | Reuse Spotlight's look and components (no credit) |
| Team | Solo |

## 8. How it works

### 8.1 Architecture (Claude's call, owner can override)

```
Phone / browser (React PWA, Firebase Hosting)
   │  Firebase Auth: anonymous for checks, Google for reports
   │  uploads → Cloud Storage for Firebase (short-lived)
   ▼
/api/**  ──(Firebase Hosting rewrite)──►  Cloud Run: "api" service (Node + TypeScript)
   │   • orchestrates a check: extract → enrich → Gemini → save
   │   • Gemini on Vertex AI (multimodal, structured JSON output, Google Search grounding)
   │   • Firestore: checks, entities, reports, stats
   │   • calls ↓ for links
   ▼
Cloud Run: "linkscan" service (Playwright/Chromium container)
   • opens a suspicious URL in an isolated headless browser, returns final URL,
     redirect chain, page title/text and a screenshot; never runs downloads
```

- **Frontend:** React + Vite + Tailwind, starting from Spotlight's UI kit (`src/components/ui/*`), app shell (`src/components/layout/*`) and toast setup. Hosted on **Firebase Hosting**, which rewrites `/api/**` to the Cloud Run service (same origin, no CORS).
- **API:** Node + TypeScript on **Cloud Run**, stateless. Reuse Spotlight's `lib/rateLimit.ts` approach for per-user/IP limits.
- **Link scanner:** separate Cloud Run service so the heavy browser image does not slow the main API. Starts from Scraper-sdk's page capture/extraction code (`apps/server/src/scraper.ts`, `extractor.ts`).
- **AI:** **Gemini on Vertex AI** via the Google Gen AI SDK. A fast Gemini Flash-class model for every check; structured output with a fixed JSON schema; Google Search grounding when the content names a company, bank, government scheme or URL. Exact model IDs are chosen at build time from what Vertex AI offers.
- **Data:** **Firestore** (Native mode). Uploads in Cloud Storage for Firebase.
- **Auth:** **Firebase Auth** — anonymous sign-in happens silently on first visit (gives every user an ID for rate limits and history); Google sign-in is prompted only when reporting.

### 8.2 One check, step by step

1. User submits input (typed, pasted, uploaded, shared via Android share menu, or "Try an example").
2. **Deterministic pre-processing (no AI):**
   - QR images decoded with a QR library; `upi://pay?...` URIs parsed into payee VPA, name, amount, note.
   - Phone numbers, UPI IDs (`name@bank`), URLs/domains, bank account / IFSC patterns extracted from text with regexes, normalised (e.g. +91 prefix, lowercase VPAs, registrable domain).
   - Each extracted identifier looked up in the Firestore scam list.
   - URLs: sent to the link scanner (redirects followed, page captured), and optionally checked with Google **Web Risk** (builder's option if quick to add).
3. **Gemini analysis:** one multimodal call with the original input (text / image / audio), the extracted identifiers, scam-list hits, link-scan result (page text + screenshot), and the user's language. Returns the JSON in §8.3. Text and images run in a single call; audio is sent as audio (Gemini transcribes and analyses in one pass).
4. **Combine:** final verdict = Gemini's assessment, raised (never lowered) by hard signals: any scam-list hit with ≥2 independent reports, a Web Risk hit, or a QR that asks you to *pay* while the message says you will *receive* money.
5. Save the check to Firestore; return the result to the UI.

### 8.3 Gemini output contract

```json
{
  "verdict": "scam | suspicious | no_signs",
  "risk_score": 0-100,
  "scam_type": "kyc_update | fake_payment | qr_receive_scam | digital_arrest | job_task | investment | loan_app | lottery_prize | delivery_customs | impersonation_bank | phishing_link | sextortion | other | none",
  "summary": "one sentence, user's language",
  "red_flags": [{"flag": "...", "evidence": "quote or region from the input", "why_it_matters": "..."}],
  "next_steps": ["..."],
  "entities": {"phones": [], "upi_ids": [], "urls": [], "bank_accounts": [], "brands_impersonated": []},
  "language": "en | hi",
  "transcript": "for audio only"
}
```

Prompt rules: never call anything "safe"; every red flag must cite evidence from the input; answer in the user's chosen UI language; use Indian context (UPI never needs a PIN to *receive* money; banks never ask for OTP; police don't arrest over video call).

### 8.4 Firestore data model

- `checks/{checkId}` — uid, input type, redacted text (identifiers kept, other personal details masked), storage path of any upload, verdict JSON, entity keys, createdAt, latency ms.
- `entities/{type:value}` — e.g. `upi:refund.sbi@ybl`, `phone:+919876543210`, `domain:sbi-kyc-update.in`. Fields: type, value, reportCount, distinct reporter uids count, scamTypes, firstSeen, lastSeen, `linked` (keys of identifiers seen in the same reports, capped).
- `reports/{reportId}` — uid (Google-signed-in), checkId, entity keys, scamType, optional state/city (user-chosen), createdAt.
- `stats/daily-{yyyy-mm-dd}` — counters by scam type and state for the trends page.

Rules: only the server writes `entities`, `reports`, `stats`; users can read their own `checks`; `entities` and `stats` are publicly readable in aggregate form (counts, not reporter IDs). One user can report a given identifier once.

### 8.5 Shared scam list semantics

- A check shows "Reported N times by N people" for any identifier with reports. Wording is always "reported", never "confirmed scammer".
- Identifiers that appear together in a report are linked; when one is checked, its linked identifiers are listed ("also reported alongside: …").
- Reporting requires Google sign-in and a check that Gemini rated scam or suspicious.

### 8.6 Screens

1. **Home / Check** — one big input (paste text or drop/upload image/audio, or paste link), language toggle (EN / हिं), "Try an example" row with 4 cards.
2. **Result** — big verdict banner (colour + icon + word), risk score, scam type, red flags with evidence highlights, next steps, scam-list hits, link scan screenshot (when a link was checked), action buttons: *Report to scam list*, *Draft complaint*, *Share warning*.
3. **Complaint draft** — pre-filled text for cybercrime.gov.in / 1930 (incident summary, scammer identifiers, amount if any, date/time, evidence list), copy button, link to cybercrime.gov.in and "call 1930" button. No auto-submission.
4. **Share warning** — a generated image card + short text in the chosen language; share via the Web Share API / WhatsApp link.
5. **Trends** — this week's top scam types, counts, recently reported identifiers (masked partially), by state if given.
6. **My checks** — history for the current user (anonymous users see this device's history).
7. **About** — how it works, privacy, disclaimer, helpline numbers.

### 8.7 Privacy and safety

- Uploaded images/audio are deleted after 7 days unless attached to a report (Cloud Storage lifecycle rule).
- Stored text is redacted of non-scam personal details (names, addresses, OTPs) before saving.
- Disclaimer on results: guidance only; when money is lost, call 1930 immediately.
- Link scanner: blocks private/internal IPs and metadata endpoints after DNS resolution and after every redirect, http/https only, hard timeout (~15s), page size cap, no file downloads, no persistent browser profile. (Same class of SSRF risk Spotlight's `api/agent-relay.ts` guards against.)
- Rate limits per uid and per IP on checks and reports; Firebase App Check is the builder's option.

### 8.8 Example scams (for "Try an example")

All synthetic, using fictional numbers/UPI IDs/domains — never real people's identifiers:

1. Fake KYC / account-block SMS with a look-alike bank link (exercises link scan).
2. Fake "payment received" screenshot (edited UPI receipt).
3. QR code shared as "scan to receive ₹5,000" that actually encodes a *pay* request.
4. "Digital arrest" / fake police voice note in Hinglish (generated with Google Cloud Text-to-Speech).

A few of these identifiers are pre-seeded in the scam list so the "reported N times" and linking behaviour is visible in the demo.

### 8.9 Evaluation (deck slide 12)

- Labelled set of ~50–60 items: scams across the types above **and** genuine messages (real-format bank alerts, OTP messages, delivery updates, genuine payment receipts) so false positives are measured.
- Script runs the set against the deployed API and reports: accuracy, scam recall, false-positive rate on genuine messages, scam-type accuracy, p50/p95 latency per input type.

## 9. Schedule (solo, ~2.5 days)

| When | Work |
|---|---|
| **16 Oct (today)** | Repo + GCP/Firebase setup; Spotlight UI shell trimmed to Scam Shield; text check end-to-end with Gemini + Firestore; **deploy to Cloud Run + Firebase Hosting on day one**. |
| **17 Oct** | Screenshots + QR; link scanner service; scam list + Google sign-in reports; complaint draft; share card; Hindi; examples; PWA + share target. |
| **18 Oct AM** | Voice notes; trends page; evaluation run; fixes; (agent tools only if ahead). |
| **18 Oct PM** | Freeze deploy by ~2 PM. README, brief description, deck (template), demo video, submit by ~8 PM. |

Cut order if behind: agent tools → voice notes.

## 10. Repository and delivery

- New public GitHub repo `Namans12/scam-shield` (owner's active account).
- README: what it is, live link, how Firebase / Firestore / Cloud Run / Gemini are used, architecture diagram, how to run, evaluation results.
- Deploy reproducibly (scripted `gcloud run deploy` / `firebase deploy`); keep min instances ≥1 on the API during evaluation to avoid cold-start timeouts (small cost, acceptable).

## 11. Calls made by Claude (owner to check)

- **Regions:** Firestore, Cloud Run and Storage in `asia-south1` (Mumbai) for Indian users; Gemini on Vertex AI via the `global` endpoint (or `us-central1`) because new models land there first. Firestore's region can't be changed later.
- **Uptime and cost:** API keeps 1 minimum instance from submission until results are announced; link scanner scales to zero (a slower first link scan is acceptable). Set a GCP budget alert and a daily cap on Gemini calls per user/IP so a public no-sign-up endpoint can't run up a bill.
- **No judging criteria were published** (owner confirmed), so priorities follow the submission rules: working demo first, visible use of all four Google services second, polish third.
- **Deck numbers:** the evaluation script's output is shaped for slide 12, and screenshots for slide 11 are captured as features land.

## 12. Left to the builder

- Exact Gemini model IDs and prompt wording.
- Backend framework (Express/Fastify/Hono) and project layout.
- Which Spotlight components to keep, and the visual polish.
- QR library, regexes, redaction method.
- Whether to add Web Risk and App Check.
- Warning-card rendering approach.
- Test framework details (Vitest already in Spotlight).
