# SDD ledger — plan: docs/superpowers/plans/2026-10-16-scam-shield.md

Spec: docs/superpowers/specs/2026-10-16-scam-shield-design.md
Branch: build (from main @ 37f639a)

## Pre-flight scan

| Pair / task | Produces → consumes | Finding |
|---|---|---|
| T2→T3,T5,T6,T7,T9,T13 | shared types, maskIdentifier, buildComplaint | consistent (mask formats match T13 warningText test) |
| T3→T5,T7 | ExtractedEntities, extractEntities, redact | consistent |
| T4→T7 | decodeQr, parseUpiUri | consistent |
| T5→T7 | VerdictModel, AnalysisError, applyHardSignals | consistent |
| T6→T7,T12,T14 | Store, Firestore layout, stats/recent | consistent; entities server-only differs from spec §8.4 → R7 |
| T7→T13 | /api/report + copyEvidence | T13 restates copyEvidence → R3 |
| T7↔T8 | LinkScan contract, ID-token auth | consistent |
| T9→T11,T12,T13,T18 | firebase.ts, api.ts, i18n MessageKey | consistent |
| T10→T12 | firebase.json (second hosting target) | consistent |
| T1 | workspaces list includes web before web exists | → R6 |
| T3 self | test expects no domain from "refund.SBI@YBL" but .sbi is a real ICANN TLD | → R4 |
| T7 self | daily_limit test (31 checks) would trip per-IP 10/min limit first | → R5 |
| T2,T4,T5,T6,T8,T9,T11–T19 self | tests vs code | agree |

## Rulings
- Ruling: Controller runs Task 0 itself (owner-account cloud ops, no code, interactive logins) — subagents can't complete browser logins — cost if wrong: setup unreviewed; low.
- Ruling: git init + branch `build` created before Task 1 (SDD workspace needs a repo; never implement on main) — merge to main at finish — cost: none.
- Ruling R3: Task 7 implements the copyEvidence call inside POST /api/report; Task 13 only exercises it — AppDeps already carries copyEvidence — cost: none.
- Ruling R4: bare-domain detection in Task 3 ignores text that is part of a UPI ID or email (`.sbi` is a real TLD) — test fixture requires it — cost: a real domain directly glued to "@" is missed; negligible.
- Ruling R5: Task 7 daily_limit test varies X-Forwarded-For (or sets perIpPerMinute high) so the per-IP limiter doesn't fire first — cost: none.
- Ruling R6: Task 1 also creates a placeholder `web/package.json` (Task 9 fills it) so the workspace list is valid — cost: none.
- Ruling R7: `entities` are server-only (no client reads), trends use `stats/recent` masked list — stricter than spec §8.4 for privacy/defamation — cost: none functionally.

- Owner instruction: implementers/fixers use model "sonnet"; reviewers, re-reviewers and final review use "opus".

## Progress
- Task 1: implemented (fc5f097..e971b73, sonnet); review dispatched (opus); minor: api/linkscan/eval tsconfig include `*.ts` placeholder — later tasks adjust; esbuild postinstall blocked by npm (npx works)
- Task 0: waiting on owner browser logins (gcloud auth login --no-launch-browser in terminal tab c2; then ADC login; firebase login)
- Task 1: complete (fc5f097..e971b73, review clean). minor (deferred): no Node engines pin; @types/node ^26 vs Node 22 target; tsconfig.base lib/types need override for web (Task 9); web/package.json formatting
- Task 2: dispatched (base e971b73, sonnet)
- Task 2: implemented (e971b73..a3fad28, sonnet); review dispatched (opus)
- Task 0: gcloud logged in as namans1201@gmail.com; project chosen by owner = project-91260b43-6705-4176-b71 (My First Project, billing on, account 01F164-CA107B-D85742). coral-mile-t3tp7 is NOT usable: org-folder project, no IAM access for owner's account, billing account not owner's — not touched.
- Task 2: complete (e971b73..a3fad28, review clean). minor (deferred): complaint heading "Scammer identifiers" states guilt (complaint.ts:18); domains list dup url+host (complaint.ts:66); hi complaint prints English scam-type slug (complaint.ts:81); weak asserts types.test.ts:35 (assert required[] and no "safe") and complaint.test.ts:29; mask.ts:22 X→* replace; schema carries $schema/default keys (check in Task 5). Reviewer verified array fields ARE required in z.toJSONSchema output mode.
- Task 3: dispatched (base a3fad28, sonnet)
- Task 0: ADC login done; quota project set; APIs enabled (step 3 done). Firebase login in terminal tab c4.
- Task 3: implemented (a3fad28..1e7a457, sonnet, resumed once after rate-limit); review dispatched (opus)
- Task 4: dispatched (base 1e7a457, sonnet)
- Task 0: BLOCKED on step 4 — `firebase projects:addfirebase` and REST addFirebase both 403 PERMISSION_DENIED although namans1201@gmail.com is roles/owner on project-91260b43-6705-4176-b71 (parent: organization 220588358843). Likely Firebase ToS not accepted / org policy. Owner action: add the project in console.firebase.google.com ("Add project" → pick existing project). Tasks 3–8 don't need Firebase; continue them meanwhile.
- Task 4: implemented (1e7a457..ce2f516, sonnet); review pending. Task 0: Firestore asia-south1 + Artifact Registry created; runtime roles granted to compute SA.
- Task 4: review: Needs fixes — Critical: tall image bypasses downscale (qr.ts:106-109) → ~1GB alloc; Important: default limitInputPixels too high + repeated decode/no timeout. Fix round 1/5 dispatched to implementer (sonnet); fix base ce2f516.
  minor (deferred): EXIF mirrored orientations not auto-oriented; key case-fold vs first-wins edge in parseUpiUri; `am` returned verbatim/untrimmed → Task 5 MUST trim/parse defensively when comparing; test gaps.
- Task 3: review: Needs fixes — Important I1: redact leaks OTP/CVV in common SMS/Hindi formats + keep-list mangling. Fix round 1/5 dispatched (sonnet, resumed); fix base 1e7a457 (note: Task 4 fixer runs concurrently, file-scoped commits).
  minor (deferred): M4 phones inside wa.me links not extracted; M5 missing-space-after-period fake domains (.click/.help); M6 UPI ID followed directly by word lost.
- Task 4: fix round 1/5 done (commit b9c73b5, tall-image bound + single decode + timeout); scoped re-review dispatched (opus) over ce2f516..b9c73b5.
- Task 0: Gemini model chosen: gemini-3.8-flash, combined JSON-schema+googleSearch WORKS (13s); gemini-2.5-flash rejects the combo. Fallback 3.7-flash two-call. Notes in docs/setup-notes.md (commit 6b139d6).
- Task 4: complete (ce2f516..b9c73b5, fix round 1 clean). minor (deferred): over-limit and grayscale tests non-discriminating; RSS test heuristic; tall chat screenshots (e.g. 1080x20000) shrink to unreadable QR — consider tiling later.
- Task 5: dispatched (base 6b139d6, sonnet) concurrently with Task 3 fix round (file-scoped commits)
- Task 3: fix round 1/5 done (b843121); scoped re-review dispatched (opus). Scratch report untracked (ad0284e).
- Task 0: Firebase added by owner; web app created; Auth initialised + Anonymous enabled via API; Storage bucket (asia-south1) created via API; web config in web/.env.production; Hosting→Cloud Run asia-south1 confirmed. REMAINING (owner): enable Google sign-in provider in console. Task 0 otherwise complete.
- Task 5: implemented (6b139d6..3e6f0f5, sonnet; live Gemini test passed: KYC scam→scam/95, genuine debit→no_signs/5); review dispatched (opus) with scoped diff review-task5.diff
- Task 6: dispatched (base 3e6f0f5, sonnet). Task 8: dispatched (base 3e6f0f5, sonnet) — parallel (different packages, file-scoped commits)
- Task 0: COMPLETE — Google provider verified enabled. All cloud prerequisites done.
- Task 3: re-review round 1: open — M3 not applied (AT_TOKEN_RE quadratic) + NEW Important regression (kept +91 contiguous phone redacted as [aadhaar], redact.ts:36/88). Also minor: uid word-boundary; OTP look-forward leaks long bank msgs (included in round 2). Fix round 2/5 dispatched (sonnet, resumed). fix base for next re-review: b843121.
- Task 5: complete (6b139d6..3e6f0f5, review clean, no fix round). minor (deferred → "prompt polish" dispatch after Task 7 when eval can measure): (1) `\bwon\b` matches "won't" → add (?!['’]t); (2) receive-word regex misses Hindi/Hinglish plurals/synonyms (मिलेंगे|milenge|जीत|jeet|इनाम|inaam|कैशबैक|रिफंड|जमा); (3) transcript/quoted evidence should stay in original language, not UI language (prompt.ts:57 vs :29); (4) combined mode lacks "what to look up / compare with official site" instruction in verdict prompt; (5) cap+wrap qr payee name & URLs in grounding prompt; (6) prompt claims screenshot attached even when non-JPEG dropped (prompt.ts:99/gemini.ts:41); (7) reword "opened safely" (prompt.ts:88) — primes forbidden word; (8) timeout test doesn't assert abortSignal.aborted; (9) SDK cast `as unknown` loses typing; (10) live test hard-codes project id fallback; (11) reported-entity raise on a no_signs verdict leaves scam_type none + "no signs" summary → reconcile in Task 7 (set scam_type "other"/regenerate summary). Note: merchant QR with "payment received"/"cashback" text can be hard-flagged.
- Task 3: fix round 2/5 done (590ee7b; regression fixed, M3 applied, uid boundary, OTP window 60); scoped re-review dispatched (opus) over b843121..590ee7b
- Task 3: re-review round 2: findings 1-3 addressed; finding 4 OTP rework caused 2 Important regressions (later 'Ref: N' beats OTP; forward window skips backward check). Fix round 3/5 dispatched (sonnet, resumed): redact ALL candidates in window both sides (over-redact is safe). fix base for next re-review: 590ee7b.
- Task 3: fix round 3/5 done (5cbd0f4, redact-all candidates); scoped re-review dispatched (opus) over 590ee7b..5cbd0f4
- Task 3: complete (a3fad28..5cbd0f4, 3 fix rounds, final re-review clean). MUST-FIX in polish dispatch (Important-class, pre-existing, found out-of-scope): CURRENCY_BEFORE (redact.ts:12/101) lacks a letter lookbehind, so "Your OTP for orders 482913" / "OTP valid 2 hrs 482913" leak the OTP → use `(?<![A-Za-z])(?:rs\.?|inr|rupees?)\s*$|₹\s*$` + tests. minor: 60-char window limit; applying edits is O(edits×n) (timing headroom ~110ms of 200ms budget on 50k chars); M4/M5/M6 deferred.
- Task 6: implemented (3e6f0f5..4451fa1, sonnet; 36/36 incl. Firestore emulator); review dispatched. NOTE for Task 10 rules: checks must stay owner-readable (uid field) because ResultPage/History read checks/{id} via client SDK; entities/reporters/reports/usage server-only; stats public-read. Seed must use encodeDocId(key)+seeded:true.
- Task 8: implemented (3e6f0f5..9a2c19c, sonnet; 78/78); built a validating proxy because Playwright 1.55 doesn't invoke route handlers for redirect hops; Docker daemon NOT running locally (image unbuilt — needs Docker Desktop start before Task 10); review dispatched (opus).
- Ruling R8: deploy images with `gcloud builds submit` (Cloud Build, API already enabled) instead of local Docker — local Docker daemon isn't running; saves a setup step; cost: Cloud Build minutes (negligible).
- Task 7: dispatched (base 9a2c19c, sonnet) while Task 6 + Task 8 reviews run.
- Task 9: dispatched (base 9a2c19c, sonnet) concurrently with Task 7 (api) — separate packages, file-scoped commits
- Task 6: complete (3e6f0f5..4451fa1, review clean, no fix round). minor (deferred): hot docs stats/recent + stats/daily + usage/global_{day} cause tx contention (skip stats reads when keys empty; bumpUsage fail-open in Task 7 — sent); byState unbounded (Task 7 validates state vs INDIAN_STATES — sent); encodeDocId doesn't guard empty/./../__x__ (callers constrained: UUID checkIds enforced in Task 7); usage uid "global" collision (prefix u_); no per-key length cap (Task 7 caps 200); linked asymmetric on repeat; EntityHit.linked returns raw keys to clients (UI masks via maskIdentifier — accepted); lockfile diff includes linkscan deps (accepted).
- Task 8: review: Needs fixes (no Critical; Important: WebRTC bypasses proxy; deadline doesn't cancel run()/leaks proxy+context; renderer OOM; --no-sandbox + frozen Chromium 140 → compensating controls). Fix round 1/5 dispatched (sonnet, resumed). fix base 9a2c19c.
- Ruling R9 (deploy, Task 10): linkscan deployed with dedicated service account `linkscan-sa` having NO roles, no VPC connector/egress, `--no-allow-unauthenticated`, invoker granted only to the API's runtime SA, concurrency 4, set LINKSCAN_NO_SANDBOX explicitly. Reviewer's `--ingress=internal` suggestion is NOT used: Cloud Run→Cloud Run via run.app URL is not internal traffic without VPC egress. Cost if wrong: linkscan reachable on public URL but still IAM-protected.
- Task 7: implemented (9a2c19c..0d95f51, sonnet; 202 tests); review dispatched (opus). concerns: first X-Forwarded-For spoofable (per-IP limiter soft; uid + global 3000/day hold); needs esbuild bundle inlining @scam-shield/shared in Task 10 Dockerfile; lockfile regenerate by web task.
- Task 8: fix round 1/5 done (64afcf8); scoped re-review dispatched (opus) 9a2c19c..64afcf8. minor: bump playwright+image to 1.55.1 (npm audit), dedicated-worker WebTransport residual in SECURITY.md, deploy script must pass LINKSCAN_NO_SANDBOX=1.
- Task 7: review: Needs fixes (5 Important: global budget drained by uid-429s; XFF first-entry spoof + fail-closed limiter lockout; image limit 8MB vs 10MB spec; Gemini raw entities stored unredacted; hard-signal verdict reads "No signs"). Fix round 1/5 dispatched (sonnet, resumed). fix base 0d95f51.
- Ruling R10: per-IP client = parts[len-TRUSTED_PROXY_HOPS(default 2)] fallback parts[0]; limiter fails OPEN when table full; verify real XFF shape at deploy (Task 10 smoke). Ruling R11: hard-signal-raised verdicts REPLACE the model's summary with a localized per-signal note + synthetic red flag + default next step.
  minor (deferred): 11 chunked oversized body error code; 14 reportable-keys abuse via Gemini-returned entities (App Check follow-up); 15 argv[1] entry detection / no start script (Task 10 bundle).
- Task 8: complete (9a2c19c..64afcf8, fix round 1 clean). POLISH batch (linkscan): time-limit closeAll (+ fallback browser.close()/reset browserPromise) so a wedged close can't permanently consume a scan slot [availability, do it]; document iframe/popup WebRTC residual in SECURITY.md + add test or confirm flag in headless-shell; correct SECURITY.md "2 renderer processes" claim; make the concurrency-cap test not hit 8.8.8.8; bump playwright to 1.55.1 + image tag v1.55.1-noble; cap `requestedUrl` in blocked(); a finished scan can race to `timeout` at the deadline edge (accept). Deploy: script MUST pass LINKSCAN_NO_SANDBOX=1 (or confirm gen2 sandbox works) else every scan fails.
- Task 9: implemented (9a2c19c..e0282a1, sonnet; 47 tests, build ok); review dispatched (opus). Notes: dev needs web/.env.local copied from .env.example; firebase chunk 148kB gz; lang toggle in Topbar.
- Task 9: review: Needs fixes (Important: Firebase eager init + Firestore/Storage in first chunk, blank page on bad env; zod pulled into main chunk via shared barrel). Fix round 1/5 dispatched (sonnet, resumed) incl. minors (timeouts/progress, 429 mapping, focus/aria-live, lang tags, char-limit note, Coming-soon captions, Hindi wording, OG meta/robots/fonts, dead-code cleanup). fix base e0282a1. Deferred: stored result size in history.state; Firestore read for /result/:id (Task 14).
- Task 7: fix round 1/5 done (1d47c10); scoped re-review dispatched (opus) 0d95f51..1d47c10
- Task 10: dispatched (base 1d47c10, sonnet) — deploys linkscan+api to Cloud Run (Cloud Build), rules/indexes/lifecycle, smoke; Hosting only if web build green. Task 7 re-review + Task 9 fix running concurrently.
- Task 9: fix round 1/5 done (604986c; main chunk 82.8→58.3 kB gz; firebase lazy); scoped re-review dispatched (opus) e0282a1..604986c
- Task 7: complete (9a2c19c..1d47c10 incl. fix round 1, review clean). POLISH batch (api): redact stored `qr` (raw/pn/tn) and `linkScan.title/text` through redact(); cap QR flag evidence at 100 chars; apply qr_receive_scam when model type is `other` and signal is QR; drop unused ParsedCheck.mimeType; pin object generation in readUpload (or rely on storage rules size cap). NOTE hop math assumes traffic arrives via Hosting — verify XFF entry count at deploy (Task 10 reporting). api still needs prod bundle/Dockerfile (Task 10).
- Task 9: complete (9a2c19c..604986c, fix round 1 clean). POLISH batch (web): link char-limit note via aria-describedby; PWA precache globIgnores for firestore/storage chunks (or runtime-cache); `vite:preloadError` → reload for stale chunks after deploy; og:image/og:url; retry test for getAuthLazy/getFirebaseApp after failure.
- Task 11: dispatched (base 604986c, sonnet) — web only; Task 10 deploy running concurrently (api/index.ts, scripts, rules).
- Ruling R12: granted compute SA roles/artifactregistry.writer (repo-scoped, scam-shield) + roles/logging.logWriter (project) so Cloud Build can push/log — needed for deploy; narrowest roles; cost if wrong: SA can push images to one repo / write logs.
- Task 10: BLOCKED→resumed (359a79f pipeline+rules+indexes+lifecycle deployed; services not yet deployed); continuing deploy + Hosting + sandbox + XFF findings; storage.rules size fix (<=15MB audio/<=10MB image) added.
- Task 11: implemented (604986c..fd4d064, sonnet; 106 web tests; storage chunk stays lazy 34.7kB); review dispatched (opus).
- Task 11: review: Needs fixes (Important: upload has no timeout/cancel — up to 10 min hang, keeps uploading after leave). Fix round 1/5 dispatched (sonnet, resumed) incl. minors (₹₹, actionable unsupported msg, window drop guard, multi-file note, Object.hasOwn, coarse-pointer hint, camera button, Hindi प्रीव्यू, QR truncation marker). fix base fd4d064. Storage rule <=15MB handled in Task 10 resume.
- Task 11: fix round 1/5 done (4cd8c6d); scoped re-review dispatched (opus) fd4d064..4cd8c6d
