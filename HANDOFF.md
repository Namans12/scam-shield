# Scam Shield: current-state handoff

State as of 18 Oct 2026. Hackathon: AI Builder Cup, track "BFSI: Intelligent Risk, Fraud & Financial Experiences". Deadline 18 Oct 2026, 23:59 IST. This note is deliberately short; the full history is in `DETAILS.md` (read its CURRENT STATE block first).

## What the project is

Scam Shield lets anyone in India check a suspicious text, screenshot, QR code, link or voice note before acting on it, in English or Hindi (Hinglish understood). It returns a verdict (Scam, Suspicious or No scam signs found; never "safe"), a risk score, red flags with evidence quoted from the input, and next steps. For scams it can draft a 1930 / cybercrime.gov.in complaint, add the scammer's identifiers to a shared scam list ("Reported N times"), and make a warning card to share. See `README.md` for the public description and `docs/ARCHITECTURE.md` for how one check works.

## Where things live

| Path | What |
|---|---|
| `web/` | React 18 + Vite + Tailwind PWA (Firebase Hosting) |
| `api/` | Hono API on Cloud Run: limits, extraction, redaction, QR decode, Gemini call, scam-list store |
| `linkscan/` | Private Playwright link scanner on Cloud Run (`linkscan/SECURITY.md`) |
| `shared/` | Types, Zod schema, identifier masking, complaint template |
| `eval/` | 185-case benchmark in three sets; combined result in `eval/results/combined.md` |
| `scripts/` | Deploy, smoke test, example generators, seed data, screenshots, deck build |
| `video/` | The demo video, built by code (`video/README.md`) |
| `docs/submission/` | Description for the form, deck (pptx and pdf), video script, sources for every statistic |
| `docs/ARCHITECTURE.md` | One-page architecture for judges |
| `docs/setup-notes.md`, `docs/handoff/sdd-ledger.md`, `docs/superpowers/` | Setup facts, build ledger, original design and plan (history) |

## What is deployed

Project `project-91260b43-6705-4176-b71`, region `asia-south1`.

- Web (Firebase Hosting): https://scam-shield-check.web.app (primary link; hosting site `scam-shield-check`, target `app-named`). The original default site https://project-91260b43-6705-4176-b71.web.app serves the same build and also works. Both rewrite `/api/**` to the API.
- Demo bank page used by the examples (fictional): https://bnb-kyc-update.web.app
- Cloud Run `scam-shield-api` (public, 1 vCPU, 1 GiB, 1 to 5 instances, one kept warm) and `scam-shield-linkscan` (private, run as a service account with no roles, scales to zero).
- Firestore and Storage rules, the Firestore index and the 7-day lifecycle rule on `uploads/` are deployed.
- Gemini on Vertex AI: `gemini-3.7-flash`, with `gemini-2.5-flash` as the retry model; Google Search grounding is off by default.
- Production is the `main` branch, kept identical to `build`.

## How to run, test and deploy

```bash
npm install
npm test                  # all workspaces (the 18 Firestore-emulator tests need Java and an emulator)
npm run typecheck
npm run build -w web
bash scripts/deploy.sh all                                   # rules, linkscan, api, web (needs gcloud and firebase CLIs, project access)
bash scripts/smoke.sh https://scam-shield-check.web.app
npx tsx eval/run.ts       # the benchmark: sequential and paced, about 8 minutes, uses real Gemini calls
```

`DETAILS.md` section 6 has more commands (seeding the demo scam list, regenerating screenshots, reading logs). The deck is rebuilt with `scripts/build-deck.sh` (see `docs/submission/deck-outline.md`); the video with `npm run render` inside `video/`.

## Decisions to keep

- Verdict words are Scam, Suspicious, No scam signs found. The word "safe" is never used as a verdict (tests enforce it in English and Hindi). The scam list says "Reported N times", never "confirmed scammer".
- Own checks (scam-list hits, a QR that asks you to pay while the text says "receive") can only raise a verdict, never lower it.
- Link scanner security controls (validating proxy, DNS pinning, zero-role service account, private service) must not be weakened.
- Every statistic used in the deck, site or video is listed in `docs/submission/sources.md`; the "victims recover about 2%" claim was unsupported and is removed everywhere.

## What is left for the owner

1. Upload the demo video (Public), then add the link to `README.md` (the "Demo video" line) and to deck slide 14 (`DECK_VIDEO_URL=https://... bash scripts/build-deck.sh`).
2. Confirm the "Provenance" paragraph in `README.md`, then remove its "(Owner: confirm ...)" note.
3. Test a real Google sign-in and a report on the live site, and the Android share menu and install on a real phone (an agent cannot do these).
4. Check that the repository and every link open in a private browser window, then fill in and submit the form (`docs/submission/description.md`).
5. Optional: delete `HANDOFF.md` and `DETAILS.md` before submitting if you prefer a leaner repository; git history is unchanged.

## Known risks

Gemini latency varies (typically 4 to 21 s, rarely slower); the benchmark is 185 synthetic cases written by the authors (combined: 98.3% accuracy, 100% scam recall, 3.3% false positives), a sanity check and not a guarantee; link scanning depends on the Cloud Run Chromium sandbox working (it does today). More in `docs/ARCHITECTURE.md` ("Known limits").
