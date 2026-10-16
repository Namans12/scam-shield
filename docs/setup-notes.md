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
