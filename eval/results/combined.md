# Scam Shield evaluation: combined official runs

Run: 2026-10-18T12:59:42.372Z (latest of 3 official runs: v1 2026-10-17, v2 2026-10-18, v3 2026-10-18) against https://project-91260b43-6705-4176-b71.web.app (language: en, concurrency: 1).
Cases: 185 synthetic cases: 90 scams, 90 genuine, 5 ambiguous. Ambiguous inputs are not scored as scam or genuine, so the metrics below use the 180 scam and genuine cases.
A message counts as flagged when the verdict is Scam or Suspicious. A case that returned an error counts as wrong (a scam with an error is a miss).

| Metric | Result |
|---|---|
| Accuracy | 98.3% |
| Scam recall (scams flagged) | 100% |
| False-positive rate (genuine flagged) | 3.3% |
| Scam type correct (among flagged scams) | 96.7% |
| Errors | 0 |

Rounding: percentages are computed from the exact counts below, rounded half up to one decimal. Exactly 0 and exactly 100 print without a decimal. A non-zero value never prints as 0 and a value below 100 never prints as 100, so a single miss or false positive always shows.

| Count | Value |
|---|---|
| Scored cases (scams + genuine) | 180 |
| Correct | 177 |
| Scams flagged / scams | 90 / 90 |
| Genuine flagged / genuine answered | 3 / 90 |
| Flagged scams with the right type | 87 / 90 |
| Ambiguous inputs given a Scam verdict (must be 0) | 0 / 5 |
| Ambiguous inputs: Suspicious / No scam signs | 1 / 4 |

| Input | p50 latency | p95 latency | Cases |
|---|---|---|---|
| text | 4.5 s | 18.2 s | 179 |
| image | 6.9 s | 8.6 s | 5 |
| audio | 10.3 s | 10.3 s | 1 |
| all successful calls | 4.7 s | 17.5 s | 185 |

Missed scams: none
False positives: l03 (Scam), l08 (Suspicious), v3g40 (Suspicious)
Ambiguous inputs given a Scam verdict: none
Errors: none

## Per run

| Run | Cases | Scams | Genuine | Ambiguous | Accuracy | Recall | False positives | Errors |
|---|---|---|---|---|---|---|---|---|
| v1 (2026-10-17) | 50 | 26 | 24 | 0 | 100% | 100% | 0% | 0 |
| v2 (2026-10-18) | 35 | 14 | 16 | 5 | 93.3% | 100% | 12.5% | 0 |
| v3 (2026-10-18) | 100 | 50 | 50 | 0 | 99.0% | 100% | 2.0% | 0 |

## Per category

Category comes from the case file: the first 50 cases have none (shown as original); v2 uses adversarial and lookalike; v3 uses realistic_scam or the topic of the genuine message. Ambiguous inputs are grouped together.

| Category | Cases | Scams | Genuine | Ambiguous | Accuracy | Recall | False positives | Errors |
|---|---|---|---|---|---|---|---|---|
| adversarial | 14 | 14 | 0 | 0 | 100% | 100% | n/a | 0 |
| ambiguous | 5 | 0 | 0 | 5 | n/a | n/a | n/a | 0 |
| appointment | 4 | 0 | 4 | 0 | 100% | n/a | 0% | 0 |
| awareness | 2 | 0 | 2 | 0 | 100% | n/a | 0% | 0 |
| bank_alert | 7 | 0 | 7 | 0 | 100% | n/a | 0% | 0 |
| bill | 6 | 0 | 6 | 0 | 100% | n/a | 0% | 0 |
| delivery | 5 | 0 | 5 | 0 | 100% | n/a | 0% | 0 |
| ecommerce | 5 | 0 | 5 | 0 | 100% | n/a | 0% | 0 |
| family_chat | 5 | 0 | 5 | 0 | 80.0% | n/a | 20.0% | 0 |
| govt_notice | 3 | 0 | 3 | 0 | 100% | n/a | 0% | 0 |
| kyc_reminder | 4 | 0 | 4 | 0 | 100% | n/a | 0% | 0 |
| lookalike | 16 | 0 | 16 | 0 | 87.5% | n/a | 12.5% | 0 |
| original | 50 | 26 | 24 | 0 | 100% | 100% | 0% | 0 |
| otp | 5 | 0 | 5 | 0 | 100% | n/a | 0% | 0 |
| realistic_scam | 50 | 50 | 0 | 0 | 100% | 100% | n/a | 0 |
| salary_credit | 4 | 0 | 4 | 0 | 100% | n/a | 0% | 0 |

## Scam recall by scam type

| Scam type | Scams | Flagged | Recall | Type correct |
|---|---|---|---|---|
| delivery_customs | 7 | 7 | 100% | 85.7% |
| digital_arrest | 8 | 8 | 100% | 100% |
| fake_payment | 7 | 7 | 100% | 100% |
| impersonation_bank | 7 | 7 | 100% | 85.7% |
| investment | 6 | 6 | 100% | 100% |
| job_task | 7 | 7 | 100% | 100% |
| kyc_update | 12 | 12 | 100% | 91.7% |
| loan_app | 5 | 5 | 100% | 100% |
| lottery_prize | 8 | 8 | 100% | 100% |
| other | 7 | 7 | 100% | 100% |
| phishing_link | 6 | 6 | 100% | 100% |
| qr_receive_scam | 6 | 6 | 100% | 100% |
| sextortion | 4 | 4 | 100% | 100% |

Official runs are listed in `eval/results/official.json`; raw results are `eval/results/*.raw.json`. This file and `web/src/benchmark.generated.json` are written by `npx tsx eval/aggregate.ts` and checked by `web/src/benchmark.test.ts`, so the landing page cannot drift from the evidence.
Landing page values: accuracy 98.3, recall 100, false-positive rate 3.3, 185 cases.
