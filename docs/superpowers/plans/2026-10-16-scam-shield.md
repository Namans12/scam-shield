# Scam Shield Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A deployed web app where anyone in India can check a suspicious text, screenshot, QR code, link or voice note and get a Gemini verdict with red flags and next steps in English or Hindi, then report it to a shared scam list, draft a cybercrime complaint and share a warning.

**Architecture:** React PWA on Firebase Hosting; `/api/**` rewritten to a Node/TypeScript Cloud Run service (Hono) that pre-processes input deterministically (entity extraction, QR decode, scam-list lookup, link scan), calls Gemini on Vertex AI for a structured verdict, applies hard-signal rules and stores results in Firestore. A second Cloud Run service (Playwright) opens suspicious links in an isolated browser. Firebase Auth (anonymous for checks, Google for reports) and Cloud Storage for Firebase (uploads).

**Tech Stack:** Node 22, TypeScript, npm workspaces, Vitest, Hono + @hono/node-server, @google/genai (Vertex mode), firebase-admin, zod v4, tldts, jsqr + sharp, ipaddr.js, Playwright (pinned 1.55.0 to match the Docker image), React 18 + Vite + Tailwind v4 + Spotlight's UI kit, firebase JS SDK, vite-plugin-pwa, Docker + Artifact Registry, gcloud + firebase CLIs.

**Spec:** `docs/superpowers/specs/2026-10-16-scam-shield-design.md`

**Schedule:** Tasks 0–10 on 16 Oct (deploy at Task 10). Tasks 11–15 on 17 Oct. Tasks 16–18 on 18 Oct morning, deploy freeze ~2 PM, Task 19 afternoon. Cut order if late: Task 18 (agent tools) → audio input in Task 11/14 (hide the audio option; backend already supports it).

## Global Constraints

- Must visibly use **Gemini on Vertex AI, Firestore, Firebase (Auth, Hosting, Storage) and Cloud Run**.
- The app never calls anything "safe". Verdict labels: `scam` → "Scam" / "धोखाधड़ी", `suspicious` → "Suspicious" / "संदिग्ध", `no_signs` → "No scam signs found" / "धोखाधड़ी के संकेत नहीं मिले". Every result shows: "Guidance only. If you've lost money, call 1930 immediately." (and Hindi equivalent).
- Scam-list wording is always "Reported N times", never "confirmed scammer".
- UI languages: `en`, `hi`. Gemini answers in the UI language chosen.
- Examples use only fictional identifiers and the fictional bank "Bharat National Bank (BNB)"; no real bank/app logos or brand names in generated assets.
- Regions: Firestore, Storage, Artifact Registry, Cloud Run = `asia-south1` (Cloud Run falls back to `us-central1` only if Task 0 finds Hosting→Cloud Run rewrites unsupported in `asia-south1`). Gemini location = `global`.
- `/api/check` must answer within **45 s** (Firebase Hosting rewrite limit is 60 s).
- Limits: 30 checks per uid per day, 3000 checks per day globally, 10 checks per IP per minute; text ≤ 5000 chars; image ≤ 10 MB; audio ≤ 15 MB.
- Allowed upload MIME types: `image/png`, `image/jpeg`, `image/webp`, `audio/mpeg`, `audio/mp4`, `audio/aac`, `audio/ogg`, `audio/wav`, `audio/webm`.
- Uploads live at `uploads/{uid}/…` and are deleted after 7 days (bucket lifecycle); reported evidence is copied to `evidence/{reportId}/…`.
- No service-account key files; Cloud Run uses its runtime service account (ADC). Firebase web config is public and may be committed.
- Spotlight code is the owner's; reuse it without attribution.

## Review Focus

- **Gemini fails or returns invalid JSON** → the user sees "Couldn't analyse this, please try again"; no verdict is invented and nothing is saved. Test in Task 7 (`returns 502 analysis_failed when the model throws`).
- **Link scanner down or slow** → the check still returns a verdict, with `linkScan.blockedReason = "scan_failed"`. Test in Task 7 (`still returns a verdict when the link scan fails`).
- **Indian number formats and Devanagari digits** (`+91-98765-43210`, `98765 43210`, `०९८७६५४३२१०`) → all normalise to `+919876543210`. Test in Task 3.
- **Anonymous user signs in with Google and that Google account already exists** → falls back to normal Google sign-in instead of erroring. Test in Task 13.
- **Same user reports the same identifier twice** → counts increase once. Test in Task 6.

---

## File Structure

```
package.json                  npm workspaces: shared, api, linkscan, web, eval
tsconfig.base.json
firebase.json  .firebaserc  firestore.rules  firestore.indexes.json  storage.rules
scripts/deploy.sh             build+push images, deploy Cloud Run, firebase deploy
scripts/smoke.sh              post-deploy checks
scripts/seed.ts               seed scam list + trends for examples
scripts/examples/             generators for example assets + demo phishing site
shared/src/types.ts           all cross-service types + zod schema for Gemini output
shared/src/mask.ts            maskIdentifier
shared/src/complaint.ts       buildComplaint (EN/HI)
api/src/extract.ts            extractEntities, normalisers, toEntityKeys
api/src/redact.ts             redact
api/src/qr.ts                 decodeQr, parseUpiUri
api/src/prompt.ts             buildVerdictPrompt, buildGroundingPrompt
api/src/gemini.ts             VerdictModel + createGeminiModel
api/src/combine.ts            applyHardSignals
api/src/store.ts              Store interface + MemoryStore
api/src/firestoreStore.ts     FirestoreStore
api/src/rateLimit.ts          ported from Spotlight lib/rateLimit.ts
api/src/linkscanClient.ts     LinkScanner + createLinkScanClient
api/src/app.ts                createApp (routes)
api/src/index.ts              wiring + server
api/Dockerfile
linkscan/src/guard.ts         isPublicAddress, assertPublicUrl
linkscan/src/scan.ts          scanUrl
linkscan/src/server.ts        POST /scan
linkscan/Dockerfile
web/                          React app (from Spotlight UI kit)
eval/cases.jsonl  eval/run.ts  eval/metrics.ts  eval/results/
docs/submission/              description.md, video-script.md, deck notes
```

---

### Task 0: Cloud project setup

No code. Verification by command output. Owner performs browser logins.

- [ ] **Step 1: Confirm CLIs.** Run `gcloud --version` and `firebase --version`. Expected: both print versions (installed by winget / npm earlier). If `gcloud` is not on PATH in a new shell, use `"$LOCALAPPDATA/Google/Cloud SDK/google-cloud-sdk/bin/gcloud"`.
- [ ] **Step 2: Owner logs in.** Owner runs `gcloud auth login`, `gcloud auth application-default login`, `firebase login` in their own terminal. Then `gcloud projects list` → pick the billing-enabled project; `gcloud config set project <PROJECT_ID>`.
- [ ] **Step 3: Enable APIs.** `gcloud services enable run.googleapis.com aiplatform.googleapis.com firestore.googleapis.com storage.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com firebase.googleapis.com firebasehosting.googleapis.com identitytoolkit.googleapis.com texttospeech.googleapis.com`. Expected: "Operation finished successfully".
- [ ] **Step 4: Firebase.** `firebase projects:addfirebase <PROJECT_ID>` (skip if already a Firebase project). `firebase apps:create web scam-shield-web` then `firebase apps:sdkconfig web` → save output for `web/.env.production` (Task 9). In Firebase console (owner): Authentication → enable **Anonymous** and **Google** providers; Storage → get started in `asia-south1`.
- [ ] **Step 5: Firestore + Artifact Registry.** `gcloud firestore databases create --location=asia-south1` and `gcloud artifacts repositories create scam-shield --repository-format=docker --location=asia-south1`.
- [ ] **Step 6: Pick the Gemini model.** Run a one-off `@google/genai` script (scratchpad, not committed) with `vertexai: true, location: "global"` listing models; choose the newest generally-available **Flash** model. Test once whether that model accepts `tools: [{googleSearch: {}}]` together with `responseJsonSchema` in one call. Record model ID and the answer in `docs/setup-notes.md`. If combined call works, Task 5 may skip the separate grounding call.
- [ ] **Step 7: Check Hosting→Cloud Run rewrite region.** Check current Firebase docs for Cloud Run rewrite region support. Record in `docs/setup-notes.md` whether `asia-south1` is supported; set `REGION_RUN` accordingly.
- [ ] **Step 8: Runtime service account roles.** Grant the default compute service account `roles/aiplatform.user`, `roles/datastore.user`, `roles/storage.objectAdmin`, `roles/firebaseauth.viewer`, `roles/run.invoker` (for calling linkscan). Expected: policy bindings printed.

### Task 1: Repository scaffold

**Files:** Create `package.json`, `tsconfig.base.json`, `.gitignore`, `README.md` (stub), `shared/package.json`, `api/package.json`, `linkscan/package.json`, `eval/package.json`, each package's `tsconfig.json` and `vitest.config.ts`, `.claude/launch.json`.

- [ ] **Step 1:** `git init` in `D:\builder-cup`; root `package.json` with `"workspaces": ["shared","api","linkscan","web","eval"]`, scripts `test` (`npm test --workspaces --if-present`), `typecheck`. `.gitignore`: `node_modules`, `dist`, `.env*` except `.env.example` and `web/.env.production`, `eval/results/*.raw.json`.
- [ ] **Step 2:** `shared` package named `@scam-shield/shared`, `"type": "module"`, `exports` pointing at `src/index.ts` (consumed as TS source; api/linkscan bundle it with esbuild, web via Vite).
- [ ] **Step 3:** Add a trivial test `shared/src/index.test.ts` asserting `1 + 1 === 2`; run `npm test -w shared` → PASS.
- [ ] **Step 4:** Create public GitHub repo: `gh repo create Namans12/scam-shield --public --source . --remote origin`. Commit `chore: scaffold workspaces` and push.

### Task 2: Shared types, masking and complaint draft

**Files:** Create `shared/src/types.ts`, `shared/src/mask.ts`, `shared/src/complaint.ts`, `shared/src/index.ts`; Tests `shared/src/mask.test.ts`, `shared/src/complaint.test.ts`, `shared/src/types.test.ts`.

**Interfaces — Produces (used by every later task):**

```ts
export type Lang = "en" | "hi";
export type Verdict = "scam" | "suspicious" | "no_signs";
export const SCAM_TYPES = ["kyc_update","fake_payment","qr_receive_scam","digital_arrest","job_task","investment","loan_app","lottery_prize","delivery_customs","impersonation_bank","phishing_link","sextortion","other","none"] as const;
export type ScamType = (typeof SCAM_TYPES)[number];
export type EntityType = "phone" | "upi" | "domain" | "acct";
export type EntityKey = `${EntityType}:${string}`;
export interface RedFlag { flag: string; evidence: string; why_it_matters: string }
export interface GeminiVerdict {
  verdict: Verdict; risk_score: number; scam_type: ScamType; summary: string;
  red_flags: RedFlag[]; next_steps: string[];
  entities: { phones: string[]; upi_ids: string[]; urls: string[]; bank_accounts: string[]; brands_impersonated: string[] };
  language: Lang; transcript?: string;
}
export const geminiVerdictSchema: z.ZodType<GeminiVerdict>;      // zod v4
export const GEMINI_RESPONSE_JSON_SCHEMA: object;                 // z.toJSONSchema(geminiVerdictSchema)
export interface UpiPayload { pa: string; pn?: string; am?: string; tn?: string }
export interface QrInfo { raw: string; upi?: UpiPayload }
export interface LinkScan { requestedUrl: string; finalUrl?: string; redirects: string[]; title?: string; text?: string; screenshotDataUrl?: string; httpStatus?: number; blockedReason?: "bad_scheme" | "bad_port" | "private_address" | "unresolvable" | "timeout" | "scan_failed" }
export interface EntityHit { key: EntityKey; reportCount: number; scamTypes: ScamType[]; linked: EntityKey[]; lastSeen: string }
export type HardSignal = "multi_reported_entity" | "reported_entity" | "qr_pay_disguised_as_receive";
export interface CheckRequest { text?: string; url?: string; storagePath?: string; mimeType?: string; lang: Lang; exampleId?: string }
export interface CheckResult extends GeminiVerdict {
  id: string; createdAt: string; inputKind: "text" | "image" | "audio" | "link";
  entityKeys: EntityKey[]; hits: EntityHit[]; hardSignals: HardSignal[];
  qr?: QrInfo; linkScan?: LinkScan; latencyMs: number;
}
export function maskIdentifier(key: EntityKey): string;
export function buildComplaint(check: CheckResult, extra: { amountLost?: string; incidentAt?: string; lang: Lang }): string;
```

- [ ] **Step 1: Write failing tests**

```ts
// mask.test.ts
expect(maskIdentifier("phone:+919876543210")).toBe("+91 98XXXXX210");
expect(maskIdentifier("upi:refund.sbi@ybl")).toBe("re******bi@ybl");
expect(maskIdentifier("domain:bnb-kyc-update.web.app")).toBe("bnb-kyc-update.web.app");
expect(maskIdentifier("acct:123456789012")).toBe("XXXXXXXX9012");
// types.test.ts
expect(geminiVerdictSchema.safeParse(validFixture).success).toBe(true);
expect(geminiVerdictSchema.safeParse({ ...validFixture, risk_score: 140 }).success).toBe(false);
expect(geminiVerdictSchema.safeParse({ ...validFixture, verdict: "safe" }).success).toBe(false);
// complaint.test.ts  (fixture: scam check with phone +917000011111, upi bnbreward.cashback@ybl, domain bnb-kyc-update.web.app)
const en = buildComplaint(fixture, { amountLost: "₹5,000", incidentAt: "16 Oct 2026, 2:30 PM", lang: "en" });
for (const s of ["+917000011111", "bnbreward.cashback@ybl", "bnb-kyc-update.web.app", "₹5,000", "1930", "cybercrime.gov.in"]) expect(en).toContain(s);
expect(buildComplaint(fixture, { lang: "hi" })).toContain("शिकायत");
```

- [ ] **Step 2:** `npm test -w shared` → FAIL (modules missing).
- [ ] **Step 3:** Implement the interfaces above. `risk_score` is an integer 0–100; arrays default to `[]`. Masking: phone keeps `+91`, first 2 and last 3 digits; UPI keeps first 2 and last 2 chars of the handle part plus `@psp`; domains unmasked; accounts keep last 4.
- [ ] **Step 4:** `npm test -w shared` → PASS.
- [ ] **Step 5:** Commit `feat(shared): types, masking, complaint draft`.

### Task 3: Entity extraction and redaction

**Files:** Create `api/src/extract.ts`, `api/src/redact.ts`; Tests `api/src/extract.test.ts`, `api/src/redact.test.ts`. Dependency: `tldts`.

**Interfaces — Produces:**

```ts
export interface ExtractedEntities { phones: string[]; upiIds: string[]; urls: string[]; domains: string[]; bankAccounts: string[] }
export function extractEntities(text: string): ExtractedEntities;   // de-duplicated, normalised
export function normalizePhone(raw: string): string | null;         // Indian mobiles → "+91XXXXXXXXXX"; 1800/1860 toll-free kept as digits
export function toEntityKeys(e: ExtractedEntities): EntityKey[];    // phone:, upi:, domain:, acct:
export function redact(text: string, keep: string[]): string;
```

- [ ] **Step 1: Write failing tests**

```ts
for (const raw of ["+91-98765-43210", "98765 43210", "09876543210", "०९८७६५४३२१०", "+91 9876543210"]) expect(normalizePhone(raw)).toBe("+919876543210");
const e = extractEntities("Pay to refund.SBI@YBL now or visit https://bnb-kyc-update.web.app/login?id=7 call 7000011111 a/c 123456789012 IFSC BNBA0001234");
expect(e.upiIds).toEqual(["refund.sbi@ybl"]);
expect(e.domains).toEqual(["bnb-kyc-update.web.app"]);
expect(e.phones).toEqual(["+917000011111"]);
expect(e.bankAccounts).toEqual(["123456789012"]);
expect(toEntityKeys(e)).toEqual(["phone:+917000011111", "upi:refund.sbi@ybl", "domain:bnb-kyc-update.web.app", "acct:123456789012"]);
expect(extractEntities("email me at ravi@gmail.com").upiIds).toEqual([]);   // emails are not UPI IDs (has a TLD)
expect(extractEntities("आपका KYC अपडेट करें: bnb-kyc-update.web.app").domains).toEqual(["bnb-kyc-update.web.app"]);
expect(redact("Your OTP is 482913. Aadhaar 1234 5678 9012, PAN ABCDE1234F, card 4111 1111 1111 1111, call 7000011111", ["+917000011111"]))
  .toBe("Your OTP is [otp]. Aadhaar [aadhaar], PAN [pan], card [card], call 7000011111");
```

- [ ] **Step 2:** `npm test -w api -- extract redact` → FAIL.
- [ ] **Step 3:** Implement. Convert Devanagari digits (U+0966–U+096F) to ASCII before matching. UPI = `[\w.\-]{2,256}@[a-zA-Z]{2,64}` with no `.` after `@`. URLs: explicit `http(s)://` plus bare domains with a public suffix (use `tldts.parse(...).isIcann`); domain key = hostname via `tldts.getHostname` (keep full host so `*.web.app` sites stay distinct). Bank accounts: 9–18 digit runs not already matched as phone/card/Aadhaar and within 30 chars of `a/c|account|acct|खाता`. Card redaction only when Luhn-valid.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(api): entity extraction and redaction`.

### Task 4: QR decoding and UPI parsing

**Files:** Create `api/src/qr.ts`; Test `api/src/qr.test.ts`; fixture generated in-test with `qrcode` (dev dependency). Dependencies: `jsqr`, `sharp`.

**Interfaces — Produces:**

```ts
export function decodeQr(image: Buffer): Promise<string | null>;
export function parseUpiUri(raw: string): UpiPayload | null;   // only upi://pay URIs
```

- [ ] **Step 1: Write failing tests**

```ts
const uri = "upi://pay?pa=bnbreward.cashback@ybl&pn=Cashback%20Reward&am=5000&tn=Reward%20credit&cu=INR";
const png = await QRCode.toBuffer(uri, { width: 400 });
expect(await decodeQr(png)).toBe(uri);
expect(parseUpiUri(uri)).toEqual({ pa: "bnbreward.cashback@ybl", pn: "Cashback Reward", am: "5000", tn: "Reward credit" });
expect(parseUpiUri("https://example.com")).toBeNull();
expect(await decodeQr(await sharp({ create: { width: 200, height: 200, channels: 3, background: "#fff" } }).png().toBuffer())).toBeNull();
```

- [ ] **Step 2:** FAIL. **Step 3:** Implement: `sharp(image).ensureAlpha().raw()` → `jsQR(data, width, height)`; downscale images wider than 1600 px first; `pa` lower-cased. **Step 4:** PASS. **Step 5:** Commit `feat(api): QR and UPI parsing`.

### Task 5: Gemini verdict model, prompts and hard signals

**Files:** Create `api/src/prompt.ts`, `api/src/gemini.ts`, `api/src/combine.ts`; Tests `api/src/prompt.test.ts`, `api/src/combine.test.ts`, `api/src/gemini.test.ts`. Dependency: `@google/genai`.

**Interfaces:**
- Consumes: Task 2 types, Task 3 `ExtractedEntities`.
- Produces:

```ts
export interface AnalyzeInput {
  text?: string; media?: { gcsUri: string; mimeType: string };
  lang: Lang; entities: ExtractedEntities; hits: EntityHit[]; qr?: QrInfo; linkScan?: LinkScan;
}
export interface VerdictModel { analyze(input: AnalyzeInput): Promise<GeminiVerdict> }   // throws AnalysisError on any failure
export class AnalysisError extends Error {}
export function createGeminiModel(cfg: { project: string; location: string; model: string; combinedGrounding: boolean }): VerdictModel;
export function buildVerdictPrompt(input: AnalyzeInput, groundingNotes?: string): string;
export function buildGroundingPrompt(input: AnalyzeInput): string | null;  // null when no URL/brand/org to look up
export function applyHardSignals(v: GeminiVerdict, ctx: { hits: EntityHit[]; qr?: QrInfo; text?: string }): { verdict: GeminiVerdict; hardSignals: HardSignal[] };
```

- [ ] **Step 1: Write failing tests**

```ts
// combine.test.ts — base = { verdict: "no_signs", risk_score: 20, ... }
expect(applyHardSignals(base, { hits: [hit("phone:+917000011111", 2)] })).toMatchObject({ verdict: { verdict: "scam", risk_score: 85 }, hardSignals: ["multi_reported_entity"] });
expect(applyHardSignals({ ...base, risk_score: 10 }, { hits: [hit("upi:x@ybl", 1)] })).toMatchObject({ verdict: { verdict: "suspicious", risk_score: 60 }, hardSignals: ["reported_entity"] });
expect(applyHardSignals({ ...base, verdict: "scam", risk_score: 95 }, { hits: [hit("upi:x@ybl", 3)] }).verdict.risk_score).toBe(95);  // never lowered
expect(applyHardSignals(base, { hits: [], qr: { raw: "upi://pay?pa=a@ybl", upi: { pa: "a@ybl" } }, text: "Scan this QR to receive your ₹5,000 cashback" }))
  .toMatchObject({ verdict: { verdict: "scam", risk_score: 85, scam_type: "qr_receive_scam" }, hardSignals: ["qr_pay_disguised_as_receive"] });
expect(applyHardSignals(base, { hits: [] })).toEqual({ verdict: base, hardSignals: [] });
// prompt.test.ts
const p = buildVerdictPrompt({ text: "hi", lang: "hi", entities: empty, hits: [] });
expect(p).toContain("Respond in Hindi");
expect(p).toMatch(/never (say|call)[^.]*safe/i);
expect(p).toContain("UPI never needs your PIN to receive money");
expect(buildGroundingPrompt({ text: "hello", lang: "en", entities: empty, hits: [] })).toBeNull();
expect(buildGroundingPrompt({ text: "visit bnb-kyc-update.web.app", lang: "en", entities: { ...empty, domains: ["bnb-kyc-update.web.app"] }, hits: [] })).toContain("bnb-kyc-update.web.app");
// gemini.test.ts — inject a fake GoogleGenAI client
// returns parsed verdict for valid JSON; throws AnalysisError for "not json", for schema-invalid JSON, and when the client rejects.
```

- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implement. `applyHardSignals`: reported-entity rule uses max `reportCount` over hits (≥ 2 → scam/85, = 1 → at least suspicious/60); QR rule fires when `qr.upi` exists and text matches `/receive|refund|cashback|prize|won|credited|मिलेगा|प्राप्त|milega/i`, and also sets `scam_type` to `qr_receive_scam` if it was `none`/`other`. Prompt rules (spec §8.3) plus: cite evidence for every red flag; Indian context lines (banks never ask for OTP; police don't arrest over video call; UPI never needs your PIN to receive money); include extracted entities, scam-list hits ("reported N times"), decoded QR payload, link scan title/final URL/redirects/text. `createGeminiModel`: `new GoogleGenAI({ vertexai: true, project, location })`; if `combinedGrounding` is false and `buildGroundingPrompt` returns a prompt, first call `generateContent` with `tools: [{ googleSearch: {} }]` and use the returned text as notes; then call with `responseMimeType: "application/json"`, `responseJsonSchema: GEMINI_RESPONSE_JSON_SCHEMA`, `temperature: 0.2`; parts = prompt text, `fileData { fileUri: gcsUri, mimeType }` for media, `inlineData` JPEG of the link screenshot when present. Validate with `geminiVerdictSchema`; any failure → `AnalysisError`. Whole `analyze` aborts after 30 s.
- [ ] **Step 4:** PASS. **Step 5:** Commit `feat(api): Gemini verdict model and hard signals`.

### Task 6: Store (memory + Firestore)

**Files:** Create `api/src/store.ts`, `api/src/firestoreStore.ts`; Test `api/src/store.test.ts`. Dependency: `firebase-admin`.

**Interfaces — Produces:**

```ts
export interface StoredCheck extends CheckResult { uid: string; redactedText?: string; storagePath?: string; screenshotPath?: string }
export interface ReportInput { uid: string; checkId: string; entityKeys: EntityKey[]; scamType: ScamType; state?: string; city?: string; day: string /* yyyy-mm-dd IST */ }
export interface Store {
  getHits(keys: EntityKey[]): Promise<EntityHit[]>;              // only keys with reportCount > 0
  saveCheck(c: StoredCheck): Promise<void>;
  getCheck(id: string): Promise<StoredCheck | null>;
  addReport(r: ReportInput): Promise<{ reportId: string; newlyCounted: EntityKey[] }>;
  bumpUsage(uid: string, day: string): Promise<{ uidCount: number; globalCount: number }>;
}
export class MemoryStore implements Store {}
export class FirestoreStore implements Store { constructor(db: Firestore) }
```

Firestore layout (spec §8.4, with the privacy change that entities are server-only): `checks/{id}`, `entities/{type:value}` {type, value, reportCount, scamTypes[], linked[] (cap 20), firstSeen, lastSeen, seeded?}, `entities/{key}/reporters/{uid}`, `reports/{id}`, `stats/daily-{yyyy-mm-dd}` {total, byType.{t}, byState.{s}}, `stats/recent` {items: [{masked, type, scamType, reportCount, lastSeen}] cap 10}, `usage/{uid}_{day}` {count}, `usage/global_{day}` {count}.

- [ ] **Step 1: Write failing tests (run against MemoryStore)**

```ts
const r1 = await s.addReport({ uid: "u1", checkId: "c1", entityKeys: ["phone:+917000011111", "upi:a@ybl"], scamType: "kyc_update", day: "2026-10-16" });
expect(r1.newlyCounted).toEqual(["phone:+917000011111", "upi:a@ybl"]);
const again = await s.addReport({ uid: "u1", checkId: "c2", entityKeys: ["phone:+917000011111"], scamType: "kyc_update", day: "2026-10-16" });
expect(again.newlyCounted).toEqual([]);
await s.addReport({ uid: "u2", checkId: "c3", entityKeys: ["phone:+917000011111"], scamType: "digital_arrest", day: "2026-10-16" });
const [hit] = await s.getHits(["phone:+917000011111"]);
expect(hit).toMatchObject({ reportCount: 2, scamTypes: ["kyc_update", "digital_arrest"], linked: ["upi:a@ybl"] });
expect(await s.getHits(["phone:+910000000000"])).toEqual([]);
expect((await s.bumpUsage("u1", "2026-10-16")).uidCount).toBe(1);
expect((await s.bumpUsage("u1", "2026-10-16")).uidCount).toBe(2);
```

- [ ] **Step 2:** FAIL. **Step 3:** Implement `MemoryStore`; implement `FirestoreStore` with the same semantics — `addReport` in one `runTransaction` (read reporter docs first, then increment only for keys without a reporter doc; update `stats/daily-*` and `stats/recent` with `maskIdentifier`); `bumpUsage` via transaction increments. **Step 4:** PASS. **Step 5:** Commit `feat(api): scam list store`.

### Task 7: API routes

**Files:** Create `api/src/rateLimit.ts` (port of Spotlight `lib/rateLimit.ts` keyed by a string instead of `IncomingMessage`; window 60 s, max 10), `api/src/linkscanClient.ts`, `api/src/app.ts`, `api/src/index.ts`; Test `api/src/app.test.ts`, `api/src/rateLimit.test.ts`. Dependencies: `hono`, `@hono/node-server`, `google-auth-library`.

**Interfaces:**
- Consumes: Tasks 3–6.
- Produces:

```ts
export interface LinkScanner { scan(url: string): Promise<LinkScan> }          // never throws; failures → { requestedUrl, redirects: [], blockedReason: "scan_failed" }
export function createLinkScanClient(baseUrl: string, timeoutMs?: number /*20000*/): LinkScanner;  // ID-token auth to Cloud Run
export interface AuthUser { uid: string; provider: string }                      // "anonymous" | "google.com" | …
export interface AppDeps {
  store: Store; model: VerdictModel; scanner: LinkScanner;
  verifyToken(idToken: string): Promise<AuthUser>;
  readUpload(path: string): Promise<{ bytes: Buffer; gcsUri: string; mimeType: string; size: number }>;
  saveScreenshot(uid: string, checkId: string, jpeg: Buffer): Promise<string>;
  copyEvidence(storagePath: string, reportId: string): Promise<void>;
  now(): Date; limits: { perUidPerDay: number; globalPerDay: number; perIpPerMinute: number };
}
export function createApp(deps: AppDeps): Hono;
```

HTTP contract:
- `GET /api/health` → `200 {ok:true}`.
- `POST /api/check` (Bearer Firebase ID token, body `CheckRequest`) → `200 CheckResult` | `400 {error:"empty_input"|"text_too_long"|"bad_url"|"unsupported_type"|"file_too_large"}` | `401` | `403 {error:"not_your_upload"}` | `429 {error:"rate_limited"|"daily_limit"}` | `502 {error:"analysis_failed"}`.
- `POST /api/report` (body `{checkId, state?, city?}`) → `200 {reportId, entityKeys}` | `401` | `403 {error:"google_sign_in_required"}` (also when the check isn't the caller's) | `404` | `409 {error:"not_reportable"|"no_identifiers"}`.

Check pipeline: validate → rate/usage limits → if `storagePath`: must start with `uploads/{uid}/`, read bytes, enforce MIME/size, image → `decodeQr` → `parseUpiUri` → `extractEntities(text + url + qr.raw)` → `store.getHits` → link scan of `url` or first URL in text (run in parallel with grounding) → `model.analyze` → `applyHardSignals` → save screenshot → `saveCheck` (with `redact` text) → respond. `inputKind` = audio/image by MIME, else link if url, else text. Abort with 502 at 45 s.

- [ ] **Step 1: Write failing tests** (fakes for all deps; `app.request()`):

```ts
it("returns 401 without a token")
it("returns 400 empty_input for {lang:'en'}")
it("returns 400 text_too_long for 5001 chars")
it("returns 403 not_your_upload for storagePath uploads/other-uid/x.png")
it("returns 429 daily_limit on the 31st check of the day for one uid")
it("returns a verdict with hits and hardSignals for a text containing a twice-reported phone")   // expect verdict 'scam', hardSignals ['multi_reported_entity']
it("decodes a QR upload and sets qr.upi.pa")
it("still returns a verdict when the link scan fails")       // scanner returns blockedReason 'scan_failed' → 200, linkScan.blockedReason === 'scan_failed'
it("returns 502 analysis_failed when the model throws")      // and store.saveCheck not called
it("report: 403 google_sign_in_required for anonymous users")
it("report: 409 not_reportable for a no_signs check")
it("report: 200 and counts entities for a google user")
```

- [ ] **Step 2:** FAIL. **Step 3:** Implement `app.ts` per contract; `index.ts` wires `FirestoreStore`, `createGeminiModel` (env `GEMINI_MODEL`, `GOOGLE_CLOUD_PROJECT`, `GEMINI_LOCATION=global`, `GEMINI_COMBINED_GROUNDING`), `createLinkScanClient(env LINKSCAN_URL)`, firebase-admin `verifyIdToken` (`provider = decoded.firebase.sign_in_provider`), Storage bucket `env STORAGE_BUCKET`, port `env PORT`. Client IP from first `X-Forwarded-For` entry. **Step 4:** PASS. **Step 5:** Commit `feat(api): check and report endpoints`.

### Task 8: Link scanner service

**Files:** Create `linkscan/src/guard.ts`, `linkscan/src/scan.ts`, `linkscan/src/server.ts`, `linkscan/Dockerfile`; Tests `linkscan/src/guard.test.ts`, `linkscan/src/scan.test.ts`. Dependencies: `playwright@1.55.0` (exact), `ipaddr.js`, `hono`, `@hono/node-server`. Start from Scraper-sdk `apps/server/src/scraper.ts` (page text extraction).

**Interfaces — Produces:**

```ts
export type LookupFn = (host: string) => Promise<string[]>;
export class BlockedUrlError extends Error { reason: NonNullable<LinkScan["blockedReason"]> }
export function isPublicAddress(ip: string): boolean;
export function assertPublicUrl(raw: string, lookup?: LookupFn): Promise<URL>;
export function scanUrl(raw: string, opts?: { timeoutMs?: number /*15000*/; lookup?: LookupFn; allowPrivateForTests?: boolean }): Promise<LinkScan>;
// server: POST /scan {url} → 200 LinkScan (blocked/failed scans are 200 with blockedReason); 400 for missing url
```

- [ ] **Step 1: Write failing tests**

```ts
for (const ip of ["10.0.0.1","127.0.0.1","169.254.169.254","172.16.5.4","192.168.1.1","100.64.0.1","0.0.0.0","::1","fd00::1","fe80::1","::ffff:127.0.0.1"]) expect(isPublicAddress(ip)).toBe(false);
for (const ip of ["8.8.8.8","142.250.183.14","2001:4860:4860::8888"]) expect(isPublicAddress(ip)).toBe(true);
await expect(assertPublicUrl("file:///etc/passwd")).rejects.toMatchObject({ reason: "bad_scheme" });
await expect(assertPublicUrl("http://example.com:8080/")).rejects.toMatchObject({ reason: "bad_port" });
await expect(assertPublicUrl("http://evil.test/", async () => ["10.1.2.3"])).rejects.toMatchObject({ reason: "private_address" });
await expect(assertPublicUrl("http://metadata.google.internal/", async () => ["169.254.169.254"])).rejects.toMatchObject({ reason: "private_address" });
// scan.test.ts — local http server with a 302 → /login page titled "BNB KYC"; allowPrivateForTests: true
expect(res).toMatchObject({ title: "BNB KYC", redirects: [expect.stringContaining("/start")] });
expect(res.screenshotDataUrl).toMatch(/^data:image\/jpeg;base64,/);
expect((await scanUrl("http://127.0.0.1:1/")).blockedReason).toBe("private_address");   // without allowPrivateForTests
```

- [ ] **Step 2:** FAIL. **Step 3:** Implement. Guard: http/https only, ports 80/443/default only, resolve all A/AAAA, all must be public. Scan: one shared Chromium; new context per scan with `acceptDownloads: false`, mobile viewport 390×844, `serviceWorkers: "block"`; `context.route("**/*")` re-checks every request's host (cached lookups) and aborts non-public ones; record the main-frame redirect chain; `goto` with `waitUntil: "domcontentloaded"` + 2 s settle; text ≤ 8000 chars; JPEG screenshot quality 60; hard timeout → `blockedReason: "timeout"`. Dockerfile `FROM mcr.microsoft.com/playwright:v1.55.0-noble`, runs bundled `dist/server.js`. **Step 4:** PASS (`npx playwright install chromium` locally first). **Step 5:** Commit `feat(linkscan): isolated link scanner`.

### Task 9: Web app shell, Firebase client and text check

**Files:** Create `web/` from Spotlight: copy `package.json` deps subset, `vite.config.ts` (keep VitePWA, drop TMDB caching rules, deny-list `/api/`), `index.html`, `src/index.css` (re-theme: keep structure, new palette — deep navy background, amber primary, red/amber/green verdict colours with AA contrast), `src/lib/utils.ts`, `src/components/ui/{button,dialog,input,segmented,separator,sheet,skeleton,sonner,tooltip}.tsx`, `src/components/layout/{AppShell,Sidebar,SidebarContext,Topbar,Footer}.tsx` (strip Spotlight nav/brand). New: `web/src/firebase.ts`, `web/src/api.ts`, `web/src/i18n/{en,hi,index}.ts`, `web/src/routes/{CheckPage,ResultPage,AboutPage}.tsx`, `web/src/components/{VerdictBanner,RedFlagList,EntityHits,LinkScanCard,Disclaimer}.tsx`, `web/.env.production` (Firebase config from Task 0). Tests `web/src/i18n/i18n.test.ts`, `web/src/components/VerdictBanner.test.tsx`.

**Interfaces — Produces:**

```ts
// firebase.ts
export const app: FirebaseApp, auth: Auth, db: Firestore, storage: FirebaseStorage;
export function ensureAnonymousUser(): Promise<User>;
// api.ts
export class ApiError extends Error { status: number; code: string }
export function checkContent(req: CheckRequest): Promise<CheckResult>;
export function reportCheck(checkId: string, place?: { state?: string; city?: string }): Promise<{ reportId: string; entityKeys: EntityKey[] }>;
// i18n
export type MessageKey = keyof typeof en;
export function useLang(): { lang: Lang; setLang(l: Lang): void };   // persisted in localStorage (try/catch), default from navigator.language
export function useT(): (key: MessageKey, vars?: Record<string, string | number>) => string;
```

Routes: `/` CheckPage (text box + paste-link field + language toggle EN/हिं), `/result/:id` ResultPage (from router state, else reads `checks/{id}` from Firestore), `/about`.

- [ ] **Step 1: Write failing tests**

```ts
expect(Object.keys(hi).sort()).toEqual(Object.keys(en).sort());
render(<VerdictBanner verdict="no_signs" lang="en" />); expect(screen.getByText("No scam signs found")).toBeInTheDocument(); expect(screen.queryByText(/safe/i)).toBeNull();
render(<VerdictBanner verdict="scam" lang="hi" />); expect(screen.getByText("धोखाधड़ी")).toBeInTheDocument();
```

- [ ] **Step 2:** FAIL. **Step 3:** Implement. Result page shows: verdict banner, risk score, scam type, summary, red flags with evidence quotes, next steps, scam-list hits ("Reported N times" + linked identifiers masked), link scan card (screenshot + final URL + redirect count), disclaimer with `tel:1930` link; action buttons are placeholders until Task 13. Show spinner with "Checking… usually 5–15 seconds". Map `ApiError.code` to friendly messages (daily_limit, analysis_failed, etc.). **Step 4:** PASS; `npm run build -w web` succeeds. **Step 5:** Commit `feat(web): app shell and text check`.

### Task 10: Deploy pipeline and first deploy (end of 16 Oct)

**Files:** Create `api/Dockerfile`, `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json`, `storage.rules`, `scripts/deploy.sh`, `scripts/smoke.sh`, `scripts/storage-lifecycle.json`, `docs/setup-notes.md` (from Task 0).

Rules (exact intent):
- Firestore: `checks/{id}` read if `request.auth.uid == resource.data.uid`; `stats/{doc}` read for all; everything else read/write `false` (server uses Admin SDK).
- Storage: `uploads/{uid}/{file}` create if `request.auth.uid == uid` and size and content type within Global Constraints; read if owner. `linkscans/{uid}/{file}` read if owner. `evidence/**` no client access.
- Lifecycle: delete objects with prefix `uploads/` older than 7 days.
- Hosting: `public: web/dist`; rewrites `/api/**` → Cloud Run `scam-shield-api` in `REGION_RUN`; `**` → `/index.html`; `Cache-Control: no-cache` on `index.html` and the service worker.

`scripts/deploy.sh [api|linkscan|web|all]`: esbuild-bundle each service (`--bundle --platform=node --format=esm --packages=external`, `@scam-shield/shared` bundled), `docker build -f <svc>/Dockerfile -t asia-south1-docker.pkg.dev/$PROJECT/scam-shield/<svc>:$(git rev-parse --short HEAD) .`, push, `gcloud run deploy`:
- `scam-shield-linkscan`: `--no-allow-unauthenticated --memory 2Gi --cpu 2 --concurrency 4 --timeout 60 --min-instances 0 --max-instances 3`.
- `scam-shield-api`: `--allow-unauthenticated --memory 1Gi --timeout 60 --min-instances 1 --max-instances 5`, env `GEMINI_MODEL, GEMINI_LOCATION=global, GEMINI_COMBINED_GROUNDING, LINKSCAN_URL, STORAGE_BUCKET, GOOGLE_CLOUD_PROJECT`.
- web: `npm run build -w web && firebase deploy --only hosting,firestore:rules,storage`.

- [ ] **Step 1:** Write the files above. **Step 2:** `bash scripts/deploy.sh all`. Expected: three successful deploys; prints the Hosting URL.
- [ ] **Step 3:** `bash scripts/smoke.sh <hosting-url>`: GET `/` → 200; GET `/api/health` → `{"ok":true}`; anonymous ID token via `identitytoolkit accounts:signUp?key=<webApiKey>`; POST `/api/check` with a KYC scam text → `verdict` is `scam` or `suspicious` within 45 s. Expected: "SMOKE OK".
- [ ] **Step 4:** Open the Hosting URL in the browser pane; run one text check by hand. Commit `chore: deploy pipeline and rules`; push.

### Task 11: Screenshot, QR and voice-note uploads

**Files:** Create `web/src/upload.ts`, `web/src/components/DropZone.tsx`; Modify `web/src/routes/CheckPage.tsx`, `web/src/routes/ResultPage.tsx` (QR card: "This QR asks you to PAY ₹{am} to {pa}"); Test `web/src/upload.test.ts`.

**Interfaces — Produces:** `export function validateFile(f: { type: string; size: number }): { ok: true; kind: "image" | "audio" } | { ok: false; code: "unsupported_type" | "file_too_large" }`; `export function uploadForCheck(file: File): Promise<{ storagePath: string; mimeType: string }>` → path `uploads/{uid}/{uuid}.{ext}`.

- [ ] **Step 1: Failing tests:** `validateFile({type:"image/png",size:1})` → `{ok:true,kind:"image"}`; `{type:"audio/ogg",size:15*1024*1024}` → ok audio; `{type:"image/png",size:10*1024*1024+1}` → `file_too_large`; `{type:"application/pdf",size:1}` → `unsupported_type`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement; DropZone accepts drag/drop, file picker, and paste of images from clipboard; optional caption text sent along with the upload (needed for the QR "receive" rule). **Step 4:** PASS. **Step 5:** Deploy web; manual check: upload a QR PNG and a voice note. Commit `feat(web): image, QR and audio checks`.

### Task 12: Example scam assets, demo phishing site and seed data

**Files:** Create `scripts/examples/make-qr.ts`, `scripts/examples/fake-payment.html`, `scripts/examples/render-receipt.ts` (Playwright screenshot of the HTML), `scripts/examples/make-voice.ts` (Cloud Text-to-Speech, `hi-IN` voice, MP3), `scripts/examples/demo-bank/index.html` (fictional "Bharat National Bank" KYC page; form submits nowhere; on submit shows "This is a Scam Shield demo page. Never enter real details."; `<meta name="robots" content="noindex">`), `scripts/seed.ts`, `web/public/examples/{qr-receive.png,fake-payment.png,digital-arrest.mp3}`, `web/src/examples.ts`, `web/src/components/ExampleRow.tsx`; Modify `firebase.json` (second Hosting target `demo-bank`, site ID `bnb-kyc-update`, fallback `bnb-kyc-update-demo`).

Fixed example content (all fictional):
- **kyc_sms (text):** "Dear BNB customer, your account will be BLOCKED today due to pending KYC. Update now: https://bnb-kyc-update.web.app or call 7000011111. -BNB Bank"
- **fake_payment (image):** UPI "Payment Successful ₹15,000" receipt with deliberate tells: 10-digit UTR (real UTRs are 12), date 31 Sep 2026, sender name and VPA mismatch.
- **qr_receive (image + caption):** QR of `upi://pay?pa=bnbreward.cashback@ybl&pn=Cashback%20Reward&am=5000&tn=Reward%20credit&cu=INR`; caption "Scan this QR to receive your ₹5,000 cashback".
- **digital_arrest (audio):** ~40 s Hinglish monologue: caller claims to be a CBI officer, says a parcel with drugs is linked to your Aadhaar, demands you stay on video call and pay ₹50,000 "verification fee" to `cbi.verify.desk@ybl`, gives number 7000022222.

`examples.ts` exports `EXAMPLES: { id: "kyc_sms" | "fake_payment" | "qr_receive" | "digital_arrest"; titleKey: MessageKey; kind: "text" | "image" | "audio"; text?: string; asset?: string; caption?: string }[]`. Clicking one runs the normal pipeline (assets fetched then uploaded via `uploadForCheck`).

Seed (`scripts/seed.ts`, idempotent, all docs `seeded: true`): entities `phone:+917000011111` (reportCount 3, kyc_update), `domain:bnb-kyc-update.web.app` (3, phishing_link), `upi:bnbreward.cashback@ybl` (2, qr_receive_scam), `phone:+917000022222` and `upi:cbi.verify.desk@ybl` (2 each, digital_arrest), linked pairwise within each example; `stats/daily-*` for the last 7 days with small realistic counts; `stats/recent`.

- [ ] **Step 1:** Write a test `web/src/examples.test.ts`: four examples, ids as above, every `titleKey` exists in `en`, assets exist in `web/public/examples/`.
- [ ] **Step 2:** FAIL. **Step 3:** Generate assets, write seed + ExampleRow, deploy both Hosting sites, run seed against Firestore. **Step 4:** PASS; manual: each example card returns `scam` on the deployed app; the KYC example shows the demo-bank screenshot and "Reported 3 times". **Step 5:** Commit `feat: one-click examples and demo data`.

### Task 13: Reporting, complaint draft and share warning

**Files:** Modify `web/src/firebase.ts` (add `signInWithGoogle`); Create `web/src/routes/ComplaintPage.tsx`, `web/src/components/ReportDialog.tsx`, `web/src/components/ShareWarning.tsx`, `web/src/share/renderCard.ts`; Tests `web/src/firebase.test.ts`, `web/src/share/renderCard.test.ts`.

**Interfaces — Produces:** `export function signInWithGoogle(): Promise<User>`; `export function warningText(check: CheckResult, lang: Lang): string`; `export function renderWarningCard(check: CheckResult, lang: Lang): Promise<Blob>` (PNG 1080×1350).

- [ ] **Step 1: Failing tests:**

```ts
// firebase.test.ts (mock firebase/auth)
it("links the anonymous user to Google when possible")              // linkWithPopup called, returns linked user
it("falls back to signInWithPopup on auth/credential-already-in-use")
// renderCard.test.ts
expect(warningText(scamFixture, "en")).toContain("Reported");   // only when hits exist
expect(warningText(scamFixture, "en")).toContain("+91 70XXXXX111");   // masked
expect(warningText(scamFixture, "en")).not.toMatch(/confirmed/i);
```

- [ ] **Step 2:** FAIL. **Step 3:** Implement. Report button visible only for `scam`/`suspicious` with ≥ 1 entity; prompts Google sign-in, optional state (dropdown of Indian states/UTs) and city; calls `reportCheck`; shows "Added to the scam list. Thank you." Complaint page: amount lost + incident date/time inputs → `buildComplaint` → copy button, `https://cybercrime.gov.in` link, `tel:1930` button. Share: `navigator.share({ files: [card], text })` when supported, else `https://wa.me/?text=` with `warningText`. Server: on report, `copyEvidence` copies the check's upload to `evidence/{reportId}/`. **Step 4:** PASS. **Step 5:** Deploy; manual: report the KYC example from a Google account, count rises to 4. Commit `feat: report, complaint draft, share warning`.

### Task 14: Trends, history, About, PWA share target

**Files:** Create `web/src/routes/{TrendsPage,HistoryPage}.tsx`, `web/src/share-target/sw-share.ts`, `web/public/manifest.webmanifest`, icons in `web/public/icons/`; Modify `web/vite.config.ts` (VitePWA `strategies: "injectManifest"` with a SW that also handles the share target), `web/src/routes/CheckPage.tsx` (consume shared payload), `web/src/routes/AboutPage.tsx` (how it works, privacy: uploads deleted after 7 days, disclaimer, helplines 1930 / cybercrime.gov.in / Chakshu at sancharsaathi.gov.in). Test `web/src/share-target/sw-share.test.ts`.

Manifest `share_target`: `{ "action": "/share-target", "method": "POST", "enctype": "multipart/form-data", "params": { "title": "title", "text": "text", "url": "url", "files": [{ "name": "media", "accept": ["image/*", "audio/*"] }] } }`. SW intercepts POST `/share-target`, stores `{title,text,url,file}` in Cache Storage key `/shared-payload`, responds `303` to `/?shared=1`; CheckPage reads and clears it, then pre-fills and auto-starts the check.

**Interfaces — Produces:** `export function parseSharedForm(fd: FormData): { text?: string; url?: string; file?: File }` (joins title+text, extracts first URL from text when `url` empty — WhatsApp puts links in `text`).

- [ ] **Step 1: Failing tests:** `parseSharedForm` with `text: "Update KYC https://bnb-kyc-update.web.app"` and empty `url` → `{ text: "Update KYC https://bnb-kyc-update.web.app", url: "https://bnb-kyc-update.web.app" }`; with a file → `file` set.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. Trends reads `stats/daily-*` (last 7 days) and `stats/recent` with Firestore client SDK: bar chart by scam type (plain CSS bars), state list, recent masked identifiers, note "Includes demo seed data". History: Firestore query `checks where uid == auth.uid orderBy createdAt desc limit 20` (composite index in `firestore.indexes.json`). **Step 4:** PASS. **Step 5:** Deploy; manual on an Android phone or Chrome device emulation: install, share text from another app. Commit `feat: trends, history, installable share target`.

### Task 15: Hindi pass and UI polish

**Files:** Modify `web/src/i18n/hi.ts`, components as needed; screenshots to `docs/submission/screenshots/`.

- [ ] **Step 1:** Run every example in Hindi; confirm Gemini's summary, red flags and next steps come back in Hindi and the UI has no untranslated strings (i18n test already enforces keys).
- [ ] **Step 2:** Phone-width check (375 px) of every page in the browser pane: no horizontal scroll, tap targets ≥ 44 px, verdict colours readable.
- [ ] **Step 3:** Capture screenshots of Check, Result (scam), Result (no signs), QR result, link-scan result, Complaint, Share card, Trends for deck slide 11.
- [ ] **Step 4:** Commit `polish: Hindi and mobile layout`.

### Task 16: Evaluation harness and results

**Files:** Create `eval/cases.jsonl`, `eval/metrics.ts`, `eval/run.ts`, `eval/results/latest.md`; Test `eval/metrics.test.ts`.

Dataset: 50 cases, all synthetic/fictional — 26 scams (20 text covering every `ScamType` except `none`, the 4 example media, 2 Hinglish texts) and 24 genuine (bank debit/credit alerts, OTP messages that say "do not share", delivery updates, genuine UPI receipts, utility bill reminders, a real-format government advisory). Each line: `{id, kind, text?, asset?, caption?, label: "scam" | "legit", scam_type?}`.

**Interfaces — Produces:**

```ts
export interface EvalRow { id: string; label: "scam" | "legit"; scamType?: ScamType; kind: string; verdict?: Verdict; predictedType?: ScamType; latencyMs?: number; error?: string }
export interface Metrics { n: number; accuracy: number; scamRecall: number; falsePositiveRate: number; typeAccuracy: number; latency: Record<string, { p50: number; p95: number }>; errors: number }
export function computeMetrics(rows: EvalRow[]): Metrics;   // "flagged" = scam or suspicious; typeAccuracy = share of flagged scams whose predictedType === scamType; rates rounded to 3 dp
```

- [ ] **Step 1: Failing test:** 4 rows — scam→scam (type match, 1000 ms), scam→no_signs (2000 ms), legit→suspicious (3000 ms), legit→no_signs (4000 ms), all kind "text" → `{accuracy: 0.5, scamRecall: 0.5, falsePositiveRate: 0.5, typeAccuracy: 1, latency: { text: { p50: 2500, p95: 3850 } }, errors: 0}` (linear-interpolated percentiles).
- [ ] **Step 2:** FAIL. **Step 3:** Implement `run.ts --base <hosting-url>`: fresh anonymous user per 25 cases (daily limit), uploads media through the Firebase Storage REST API with the user's token, concurrency 3, writes `eval/results/<timestamp>.raw.json` and `latest.md` (table formatted for deck slide 12). **Step 4:** PASS; run against the deployed app; if false-positive rate > 0.15 or scam recall < 0.85, adjust the prompt (Task 5 `buildVerdictPrompt`) and re-run once. **Step 5:** Commit `feat(eval): benchmark harness and results`.

### Task 17: Hardening and cost guards

**Files:** Modify `scripts/smoke.sh`, `docs/setup-notes.md`.

- [ ] **Step 1:** Create a GCP budget alert (owner, in console or `gcloud billing budgets create`) at a small monthly amount with 50/90/100% email alerts.
- [ ] **Step 2:** Confirm `scam-shield-api` has min instances 1; run `smoke.sh` three times at 1-minute intervals → all "SMOKE OK".
- [ ] **Step 3:** Abuse checks by hand: 11 rapid checks from one browser → 11th gets the friendly rate-limit message; link to `http://169.254.169.254/` → result shows link scan blocked, no crash; upload a 20 MB file → friendly too-large message.
- [ ] **Step 4:** Commit `chore: hardening checks`.

### Task 18 (cut first): WebMCP agent tools

**Files:** Create `web/src/webmcp/registerTools.ts`, `web/src/webmcp/modelContext.d.ts` (copy from Spotlight `src/webmcp/modelContext.d.ts`); Test `web/src/webmcp/registerTools.test.ts`.

**Interfaces — Produces:** `export function registerScamShieldTools(mc: ModelContext | undefined): string[]` — registers `check_message` (`{ text: string; lang?: "en" | "hi" }` → `CheckResult` summary) and `report_scam` (`{ checkId: string }` → result, or an instruction to sign in with Google when anonymous); returns registered tool names; no-op returning `[]` when `mc` is undefined.

- [ ] **Step 1: Failing test:** with a fake `modelContext`, returns `["check_message", "report_scam"]` and the `check_message` handler calls `checkContent` with the given text; with `undefined` returns `[]`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement following Spotlight `src/webmcp/registerTools.ts`. **Step 4:** PASS. **Step 5:** Deploy; commit `feat(web): WebMCP tools`.

### Task 19: Submission package (18 Oct afternoon, after deploy freeze)

**Files:** Create/Modify `README.md`, `docs/submission/description.md`, `docs/submission/video-script.md`, `docs/submission/architecture.png` (or Mermaid in README), deck PPTX/PDF.

- [ ] **Step 1: README:** what it is; live link; demo video link; how **Firebase** (Auth anonymous + Google, Hosting, Storage), **Firestore** (checks, scam list, reports, trends, usage limits), **Cloud Run** (API + isolated link scanner) and **Gemini on Vertex AI** (multimodal verdict, audio transcription, Search grounding, structured output) are used; architecture diagram; local run; evaluation table from `eval/results/latest.md`; privacy notes.
- [ ] **Step 2:** `description.md` — ≤ 250 words brief description naming all four services.
- [ ] **Step 3:** Deck — owner downloads the template as PPTX (File → Download → .pptx); fill slides 1–14 using the pptx skill from: spec §1 (idea, opportunities, USP vs Truecaller/Google/Chakshu), features list, process flow diagram (one check, step by step), wireframes = screenshots, architecture diagram, technologies, cost estimate (Cloud Run min instance + Gemini Flash per-check cost), screenshots, eval table, future work (more languages, misinformation mode, Android app, bank/telecom partnerships, Web Risk), links. Export PDF ≤ 5 MB.
- [ ] **Step 4:** `video-script.md` — 3:30 shot list: problem (20 s) → text KYC example (35 s) → QR example (30 s) → voice note (30 s) → link scan screenshot (25 s) → report + complaint + share card (40 s) → trends + Hindi toggle (20 s) → architecture + Google services (20 s) → close (10 s). Owner records with screen capture and uploads (YouTube unlisted).
- [ ] **Step 5:** Final `smoke.sh`; verify repo is public, all links open in a private window; commit `docs: submission package`; push. Owner submits the form.
