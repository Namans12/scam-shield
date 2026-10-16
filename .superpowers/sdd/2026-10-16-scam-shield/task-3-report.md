# Task 3 report: entity extraction and redaction

## Built
- `api/src/extract.ts`: `extractEntities`, `normalizePhone`, `toEntityKeys`, plus helpers `toAsciiDigits`, `luhnValid`.
- `api/src/redact.ts`: `redact(text, keep)` (OTP, Aadhaar, PAN, Luhn-valid cards; `keep` entries untouched).
- Tests: `api/src/extract.test.ts`, `api/src/redact.test.ts` (brief assertions verbatim plus edge cases: empty input, dedupe, Hinglish, UTR/Aadhaar not phone/account, Luhn-invalid card, toll-free, non-mobiles).
- `api/package.json`: deps `tldts`, `@scam-shield/shared: "*"`; `package-lock.json` updated.

## Design notes
- R4: pipeline order is URLs (blanked) -> UPI ids (blanked) -> any other `@` token (emails, blanked) -> phones -> cards/Aadhaar -> accounts -> bare domains. So `refund.SBI@YBL` gives no `.sbi` domain; emails give no UPI and no domain.
- Bare domains require `tldts` domain + public suffix (ICANN or private), so `bnb-kyc-update.web.app` is accepted; full hostname kept.
- A contiguous 12-digit run is never a phone. Aadhaar blanking in extraction needs separators (so `a/c 123456789012` stays an account). Accounts skipped when preceded by utr/ref/txn/order etc.
- `redact` does not redact bank account numbers (not in brief; scammer accounts are evidence).
- Known limits: `me@home`-style tokens read as UPI; `photo.zip` reads as a domain.

## RED (before implementation)
```
FAIL  src/extract.test.ts [ src/extract.test.ts ]
Error: Cannot find module './extract' imported from D:/builder-cup/api/src/extract.test.ts
FAIL  src/redact.test.ts [ src/redact.test.ts ]
Error: Cannot find module './redact' imported from D:/builder-cup/api/src/redact.test.ts
Test Files  2 failed (2)   Tests  no tests
```
First implementation run also failed on real assertions (acct blanked as Aadhaar, OTP sep regex, my own 1-char UPI test input), fixed.

## GREEN
```
RUN  v5.0.5 D:/builder-cup/api
Test Files  2 passed (2)
     Tests  17 passed (17)
```
`npm run typecheck` (all workspaces): clean.

## Concerns
None blocking. `shared/` not modified.

---

# Fix report (review round 1)

## Changes
- `api/src/patterns.ts` (new): shared `toAsciiDigits`, `luhnValid`, `CARD_RE`, `AADHAAR_SEP_RE`, `AADHAAR_ANY_RE` (M9). `extract.ts` imports them and re-exports `luhnValid`/`toAsciiDigits`.
- `api/src/redact.ts` rewritten (I1, M1, M7, M8):
  - Kept values (raw or entity keys like `phone:+91...`, digit values match with spaces/dashes) are masked with `#` before any pattern runs, so OTP/card/Aadhaar patterns can never consume them ("Send OTP to 98765 43210" and a kept 12-digit account survive; a card no longer swallows an adjacent kept phone).
  - Edits are collected on the masked copy and applied back to the original; earlier edits win on overlap.
  - OTP: label scan (otp, o.t.p, one time password/pin/code, verification/security code, passcode, password, pin, code, cvv/cvc, Hindi ओटीपी / ओ.टी.पी / वन टाइम पासवर्ड) finds a standalone digit run after the label (25 chars), skipping amounts (Rs/INR/₹/rupees prefix, comma/decimal grouped) and alphanumeric codes (IFSC `BNBA0001234`); works with no separator (`OTP482913`). If none, looks back for a number directly before the label ("482913 is OTP", "Use 482913 as your OTP"). Length 4-8, CVV/CVC 3-4. CVV is redacted with the same `[otp]` placeholder.
  - PAN case-insensitive.
- `api/src/extract.ts` (M2, M3, M9): 12-digit runs with aadhaar/aadhar/आधार/uid in the 20 chars before are not bank accounts; `AT_TOKEN_RE` anchored `(?<!\S)\S*@\S*`; helpers moved to patterns.ts.
- Tests added: every I1 format, kept-phone/IFSC safety, OTP_AFTER, PAN case, contiguous Aadhaar, kept 12-digit account (raw and `acct:` key), entity-key keep, card vs kept phone, UPI followed by comma/period, Aadhaar-label account, and < 200 ms timing tests on 5,000-char adversarial inputs for both modules.

## RED (new tests, before implementation)
Command: `npx vitest run --root api src/extract src/redact`
```
 × redacts: 482913 is OTP for txn of INR 2,500 at XYZ
 × redacts: OTP for Rs 5000 is 482913   (also Rs. / rupee-sign variants)
 × redacts: Use 482913 as your OTP
 × redacts: OTP482913
 × redacts: आपका ओटीपी 482913 है   (also ओ.टी.पी, वन टाइम पासवर्ड ४८२९१३)
 × redacts: CVV 123 / CVV: 123
 × does not redact a kept phone that follows an OTP word   (got "Send OTP to [otp] 43210")
 × does not mangle IFSC after the word code               (got "IFSC code BNBA[otp]")
 × matches PAN case-insensitively
 × keeps a kept 12-digit account that would otherwise look like Aadhaar
 × a card number does not swallow an adjacent kept phone
 × does not treat a 12-digit number after an Aadhaar label as a bank account
 Test Files  2 failed (2)   Tests  17 failed | 25 passed (42)
```
(Already passing before the change: OTP_AFTER "482913 is your OTP", UPI followed by punctuation, contiguous Aadhaar, timing tests, entity-key keep as phone.)

## GREEN
Command: `npm test -w api -- extract redact`
```
 Test Files  2 passed (2)
      Tests  42 passed (42)
```
`npm run typecheck`: no errors (at the time of the final run; an earlier run showed errors only from another agent's in-progress `gemini`/`prompt` files).

## Notes
- Only my own files were staged/committed (extract/redact sources and tests, patterns.ts).
- Tooling quirk: the shell heredoc collapsed `\` in my first write of redact.ts; fixed with Edit and covered by the tests.
