# Setup notes (Task 0)

- GCP project: `project-91260b43-6705-4176-b71` ("My First Project", number 494852004380), billing account `01F164-CA107B-D85742`, owner `namans1201@gmail.com`.
- Regions: Firestore + Artifact Registry (`scam-shield` docker repo) in `asia-south1`; Cloud Run `asia-south1` unless the Hosting rewrite check below says otherwise; Gemini via the `global` endpoint.
- Runtime service account: `494852004380-compute@developer.gserviceaccount.com` has `aiplatform.user`, `datastore.user`, `storage.objectAdmin`, `run.invoker`, `firebaseauth.viewer`.
- APIs enabled: run, aiplatform, firestore, storage, artifactregistry, cloudbuild, firebase, firebasehosting, identitytoolkit, texttospeech.

## Gemini model (tested 2026-10-16 via Vertex AI REST, `global` location)

| Model | JSON schema output | JSON schema + `googleSearch` in one call | Latency (short prompt) |
|---|---|---|---|
| `gemini-3.8-flash` | works | **works** (13 s with search) | ~5 s |
| `gemini-3.7-flash` | works | not tested | ~4 s |
| `gemini-3.5-flash` | works | not tested | ~4.6 s |
| `gemini-2.5-flash` | works | **fails**: "controlled generation is not supported with Search tool" | ~5 s |

Decision: `GEMINI_MODEL=gemini-3.8-flash`, `GEMINI_COMBINED_GROUNDING=true` (single call with structured output + Search). Fallback if it misbehaves in production: `gemini-3.7-flash` with `GEMINI_COMBINED_GROUNDING=false` (two-call path: search first, then JSON). Only add the search tool when the content names a URL/brand/organisation (keeps most checks at ~5 s).

## Firebase

`firebase projects:addfirebase` and the REST `addFirebase` both returned 403 PERMISSION_DENIED even though the account is project owner (project sits under an organisation). Owner adds the project in console.firebase.google.com (accept terms), enables Anonymous + Google auth, creates Storage in `asia-south1`.

## Firebase status (16 Oct)

- Project added to Firebase by the owner in the console. Web app `scam-shield-web` (appId `1:494852004380:web:b1c5bafffa9aa58d631dd9`) created; public web config in `web/.env.production`.
- Auth initialised via API; **Anonymous provider enabled**. Google provider: see below.
- Default Storage bucket created via API: `project-91260b43-6705-4176-b71.firebasestorage.app` in `asia-south1`.
- Default Hosting site: `project-91260b43-6705-4176-b71` (`.web.app` / `.firebaseapp.com`).
- Firebase Hosting → Cloud Run rewrites support `asia-south1` (checked against the Firebase docs 16 Oct), so `REGION_RUN=asia-south1`.
- Google sign-in provider ENABLED by owner (verified via API 16 Oct).

## Deploy pipeline (Task 10, 16 Oct)

- `scripts/deploy.sh [api|linkscan|web|rules|all]`: images are built with Cloud Build (`cloudbuild.yaml`, repo root as context, `_SVC=api|linkscan`), tagged with the git short sha (`-dirty` suffix when the image inputs have uncommitted changes), then `gcloud run deploy`. `scripts/smoke.sh <base-url>` is the post-deploy check. Env flags: `LINKSCAN_NO_SANDBOX=1` (linkscan), `DEBUG_XFF=1` (api: `/api/health` also returns `xff` = number of X-Forwarded-For entries received and `hops`; default off, never logs addresses).
- Rules, indexes and the 7-day `uploads/` lifecycle were deployed 16 Oct (`scripts/deploy.sh rules`): Firestore `checks` owner-read, `stats` public read, everything else denied; Storage `uploads/{uid}` owner create/read/delete (size < 15 MB, image/audio types only), `linkscans/{uid}` owner read, everything else denied. NOTE: the API actually stores screenshots under `screenshots/{uid}/...`, which the spec'd rules deny to clients; the web app does not read them from Storage, so this is harmless.
- Services: `scam-shield-api` (public, gen2, 1 CPU / 1 GiB, concurrency 20, min 1 / max 5, runs as the default compute SA) and `scam-shield-linkscan` (private, gen2, 2 CPU / 2 GiB, concurrency 4, min 0 / max 3, dedicated zero-role SA `linkscan-sa@project-91260b43-6705-4176-b71.iam.gserviceaccount.com`, no VPC; `run.invoker` on that service granted to the API's SA).
- The API image bundles `api/src/index.ts` with esbuild; `@scam-shield/shared` is inlined with `--alias:@scam-shield/shared=./shared/src/index.ts`, everything else stays external and comes from `npm ci --omit=dev -w api`.
- Cloud Build runs as the default compute SA, which needs `roles/artifactregistry.writer` (on the `scam-shield` repo) and `roles/logging.logWriter` to push images / write build logs. Both are missing: see the Task 10 report. Status of the first deploy is recorded below once images can be pushed.

## Deploy status, 16 Oct 2026 (evening, redeploy from a second machine)
- Redeployed `linkscan`, `api` (both from `dfbe36f`, clean tree), Hosting, and rules (Storage audio <= 15 MB / image <= 10 MB, `screenshots/{uid}` owner-read, lifecycle verified). `scripts/smoke.sh` against the Hosting URL: SMOKE OK (scam text -> scam in ~14-20 s).
- Chromium sandbox: a real URL scan (`https://example.com/`) through Hosting returns title and text on Cloud Run gen2 **without** `LINKSCAN_NO_SANDBOX`. Keep it off.
- Still open: X-Forwarded-For hop count (`TRUSTED_PROXY_HOPS=2` assumed, not measured), budget alert (owner), polish batch in HANDOFF.md section 5.
- Mac setup: `brew install --cask gcloud-cli` (add `/opt/homebrew/share/google-cloud-sdk/bin` to PATH), `npm i -g firebase-tools`, `npx playwright install chromium` in `linkscan/` (Playwright 1.55.0 needs chromium build 1187).
