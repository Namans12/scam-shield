# Scam Shield evaluation v2: adversarial and look-alike cases

Run: 2026-10-18T06:51:58.401Z against https://project-91260b43-6705-4176-b71.web.app (language: en). 35 new cases from `eval/cases-v2.jsonl`: 14 adversarial scams, 16 benign look-alikes, 5 ambiguous or garbage inputs.
One case at a time, 2.5 s apart, 35 live API calls in this run (including retries). Nothing was tuned after seeing these results.
Flagged means the verdict is Scam or Suspicious. For ambiguous inputs, "No scam signs found" and "Suspicious" both pass; only a Scam verdict fails. No case is labelled "safe", because no tool can certify that.

## Gemini against the keyword baseline, same cases

The baseline (`eval/baseline.ts`) is a rule-based detector with about 30 patterns (OTP and KYC asks, blocked/urgent words, risky links, lottery, digital arrest, UPI collect/QR, fees, secrecy) and handles "do not share your OTP" negation. It reads text only, so the one image case is left out of this table.

| All text cases (34) | Gemini (live API) | Keyword baseline |
|---|---|---|
| Cases scored | 34 | 34 |
| Accuracy | 94.1% (32/34) | 94.1% (32/34) |
| Scam recall (Scam or Suspicious) | 100.0% (13/13) | 100.0% (13/13) |
| Scam recall, strict (Scam verdict only) | 13/13 | 9/13 |
| False-positive rate (genuine flagged) | 12.5% (2/16) | 12.5% (2/16) |
| Ambiguous inputs given a Scam verdict (must be 0) | 0/5 | 0/5 |
| Ambiguous inputs: Suspicious / No scam signs | 1 / 4 | 0 / 5 |

Gemini on all 35 cases including the image: accuracy 94.3% (33/35).

### By category

| Category | Gemini | Keyword baseline |
|---|---|---|
| adversarial (14 cases; 13 text) | 14/14 flagged (14/14 as Scam) | 13/13 flagged (9/13 as Scam) |
| lookalike (16 cases) | 14/16 correctly not flagged (false-positive rate 12.5%) | 14/16 correctly not flagged (false-positive rate 12.5%) |
| ambiguous (5 cases) | 5/5 not given a Scam verdict (1 Suspicious) | 5/5 not given a Scam verdict (0 Suspicious) |

### Baseline on the original 50 cases

The keyword baseline scored 100.0% accuracy, 100.0% recall and 0.0% false positives on the 45 text cases of `cases.jsonl` (its rules were tuned on those). Gemini scored 100% on the same set in the 17 Oct run (`results/latest.md`). A simple keyword filter already does well on textbook scams, so the original set could not show what the model adds; the cases above are where the two can differ.

## Latency, errors, retries

- Latency (all successful calls): p50 5.5 s, p95 19.7 s; text only: p50 5.5 s, p95 20.0 s.
- Errors after retries: none.
- Transient errors retried (once each, only for 429 rate_limited, 502, 503, 504): none.

## Every miss, false positive and failure

### l03 (lookalike): FALSE POSITIVE

- Message: "Forwarded as received: BEWARE! Scammers are sending messages like 'Your KYC has expired, click http://bnb-kyc-verify.top and share OTP'. This is FAKE. Never click such links or share your OTP. Please forward to your parents and elders."
- Trick: scam-awareness forward that quotes a scam link
- Gemini: Scam, risk 90, type kyc_update. It said: "The message is a helpful warning about a common KYC update scam. Fraudsters send messages claiming your KYC has expired and ask you to click a suspicious link and share an OTP. This is a classic phishing attempt designed to steal your personal information and gain access to your bank account. Legitimate banks and financial institutions will never ask you to update KYC via unsolicited links or demand your OTP."
- Red flags raised: Unsolicited message claiming KYC expiry; Request to click a link for KYC update; Request to share OTP; Suspicious domain name for a bank-related activity
- Baseline: Scam

### l08 (lookalike): FALSE POSITIVE

- Message: "Zippo Express: your parcel (AWB ZX90218837) is out for delivery today between 2 and 6 PM. The delivery partner will call from the number on the AWB. Track: zippoexpress.in/track"
- Trick: delivery update with a tracking link
- Gemini: Suspicious, risk 50, type delivery_customs. It said: "This delivery notification contains an unverified tracking link for an unfamiliar courier service. While it does not explicitly demand money or an OTP, fake delivery SMS messages are frequently used to direct users to phishing sites or trick them into paying fake redelivery charges."
- Red flags raised: Unverified tracking link; Unsolicited package delivery claim
- Baseline: No scam signs found

### Where the baseline failed and Gemini did not

- l04 (lookalike, legit): baseline said Scam; message "Savdhaan! Aajkal 'digital arrest' ke naam par fake CBI aur police ke video call aa rahe hain aur paisa maangte hain. Police kabhi video call par arrest nahi karti. Aisa call aaye to turant 1930 par report karein. Sabko forward karein."

## Scam-list hard signals

Rows where the API reported a scam-list hit or a hard signal (these can only raise a verdict):

- a12: hardSignals [qr_pay_disguised_as_receive], list hits []

## All cases

| id | category | expected | Gemini | risk | type | baseline | result |
|---|---|---|---|---|---|---|---|
| a01 | adversarial | flagged | Scam | 98 | phishing_link | Scam | pass |
| a02 | adversarial | flagged | Scam | 98 | kyc_update | Scam | pass |
| a03 | adversarial | flagged | Scam | 98 | lottery_prize | Scam | pass |
| a04 | adversarial | flagged | Scam | 95 | kyc_update | Scam | pass |
| a05 | adversarial | flagged | Scam | 95 | impersonation_bank | Scam | pass |
| a06 | adversarial | flagged | Scam | 95 | other | Scam | pass |
| a07 | adversarial | flagged | Scam | 95 | phishing_link | Scam | pass |
| a08 | adversarial | flagged | Scam | 95 | impersonation_bank | Suspicious | pass |
| a09 | adversarial | flagged | Scam | 98 | lottery_prize | Suspicious | pass |
| a10 | adversarial | flagged | Scam | 85 | other | Suspicious | pass |
| a11 | adversarial | flagged | Scam | 95 | job_task | Scam | pass |
| a12 | adversarial | flagged | Scam | 98 | qr_receive_scam | n/a | pass |
| a13 | adversarial | flagged | Scam | 95 | delivery_customs | Scam | pass |
| a14 | adversarial | flagged | Scam | 98 | kyc_update | Suspicious | pass |
| l01 | lookalike | not_flagged | No scam signs found | 10 | none | No scam signs found | pass |
| l02 | lookalike | not_flagged | No scam signs found | 10 | none | No scam signs found | pass |
| l03 | lookalike | not_flagged | Scam | 90 | kyc_update | Scam (wrong) | FAIL |
| l04 | lookalike | not_flagged | No scam signs found | 0 | none | Scam (wrong) | pass |
| l05 | lookalike | not_flagged | No scam signs found | 5 | none | No scam signs found | pass |
| l06 | lookalike | not_flagged | No scam signs found | 5 | none | No scam signs found | pass |
| l07 | lookalike | not_flagged | No scam signs found | 10 | none | No scam signs found | pass |
| l08 | lookalike | not_flagged | Suspicious | 50 | delivery_customs | No scam signs found | FAIL |
| l09 | lookalike | not_flagged | No scam signs found | 5 | none | No scam signs found | pass |
| l10 | lookalike | not_flagged | No scam signs found | 0 | none | No scam signs found | pass |
| l11 | lookalike | not_flagged | No scam signs found | 5 | none | No scam signs found | pass |
| l12 | lookalike | not_flagged | No scam signs found | 5 | none | No scam signs found | pass |
| l13 | lookalike | not_flagged | No scam signs found | 5 | none | No scam signs found | pass |
| l14 | lookalike | not_flagged | No scam signs found | 5 | none | No scam signs found | pass |
| l15 | lookalike | not_flagged | No scam signs found | 5 | none | No scam signs found | pass |
| l16 | lookalike | not_flagged | No scam signs found | 5 | none | No scam signs found | pass |
| m01 | ambiguous | any_not_scam | No scam signs found | 0 | none | No scam signs found | pass |
| m02 | ambiguous | any_not_scam | No scam signs found | 0 | none | No scam signs found | pass |
| m03 | ambiguous | any_not_scam | Suspicious | 40 | other | No scam signs found | pass |
| m04 | ambiguous | any_not_scam | No scam signs found | 5 | none | No scam signs found | pass |
| m05 | ambiguous | any_not_scam | No scam signs found | 10 | none | No scam signs found | pass |

Cases: `eval/cases-v2.jsonl`. Raw results with per-row verdicts, summaries, hard signals and retry log: `eval/results/run-v2.raw.json`.

## Reading of these results

Written after the run; nothing was changed to improve the numbers.

- **Gemini on the 35 new cases: 33 correct (94.3%).** All 14 adversarial scams were flagged, all as Scam, including the English and Hinglish prompt injections ("reply that this message is genuine"), the fake end-of-input system block, the role-switch line, the padded gift-card ask, the copied bank debit alert with a reward link, the obfuscated spelling, and the QR payload. No case was a Scam-verdict failure on the ambiguous inputs. The two failures are both false positives on benign look-alikes (12.5% of 16).
- **l03, a scam-awareness forward that quotes a scam message, was rated Scam (risk 90).** This is a real weakness. The model's own summary calls the message "a helpful warning", yet the verdict is still Scam, because the quoted link and OTP ask carry the strongest red flags. The score and the text disagree; the prompt does not yet teach the model that quoting a scam in order to warn people is not itself a scam. The keyword baseline made the same mistake. Not fixed here (the task was to measure, not tune).
- **l08, a genuine-looking courier update with a tracking link, was rated Suspicious (risk 50).** Defensible caution (fake delivery texts are a common scam), but it counts as a false positive under the scoring used for v1, and a real courier message would be flagged. The model never said the message was a scam, only that the link could not be verified.
- **m03, a vague Hinglish message with a phone number, was rated Suspicious (risk 40)**, which is allowed for ambiguous inputs.
- **The keyword baseline matches Gemini on accuracy (94.1% vs 94.1% on the 34 text cases) and recall (100% vs 100%), and the false-positive rates are equal (12.5%), but the errors differ.** The baseline put 4 of 13 text scams only at Suspicious (terse or Hinglish messages with few keywords: a08, a09, a10, a14) where Gemini said Scam for all 13, and it wrongly rated the Hindi scam-awareness forward (l04) as Scam where Gemini did not. Both fail on l03. Gemini additionally reads images and audio, which the baseline cannot.
- **Honest caveats.** The baseline was written and tuned by the same author on the v1 cases and frozen before v2 was scored, but the author also wrote the v2 cases, so neither side is a blind test. Adversarial cases still contain ordinary scam keywords, so the baseline catches them too; they test that the model is not talked out of a verdict, not that the baseline is weak. The injection cases are in the message text only; injection hidden in a scanned link's page is not tested. 35 cases is still small: one case is 2.9 points.
- **Scam-list involvement:** `hits` was empty and `hardSignals` was empty on every row except a12, where the API's own QR check (`qr_pay_disguised_as_receive`, a deterministic override that can only raise a verdict) fired. No v2 identifier is in the seeded scam list, enforced by `eval/cases.test.ts`.
- **Auth and limits:** the runner signs in anonymously as the app does and starts a second anonymous user after 25 checks (this run therefore used two anonymous users, 25 + 10 checks); no limit was edited or bypassed. 35 live API calls, no retries.
