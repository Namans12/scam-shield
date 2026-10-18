# Scam Shield evaluation v3: realistic scams and genuine messages

Run: 2026-10-18T12:59:42.372Z against https://project-91260b43-6705-4176-b71.web.app (language: en). 100 new cases from `eval/cases-v3.jsonl`: 50 scams, 50 genuine messages.
One case at a time, 2.5 s apart, 100 live API calls in this run (including retries). Nothing was tuned after seeing these results.
Flagged means the verdict is Scam or Suspicious. For ambiguous inputs, "No scam signs found" and "Suspicious" both pass; only a Scam verdict fails. No case is labelled "safe", because no tool can certify that.

## Gemini against the keyword baseline, same cases

The baseline (`eval/baseline.ts`) is a rule-based detector with about 30 patterns (OTP and KYC asks, blocked/urgent words, risky links, lottery, digital arrest, UPI collect/QR, fees, secrecy) and handles "do not share your OTP" negation. It reads text only, so the one image case is left out of this table.

| All text cases (100) | Gemini (live API) | Keyword baseline |
|---|---|---|
| Cases scored | 100 | 100 |
| Accuracy | 99.0% (99/100) | 84.0% (84/100) |
| Scam recall (Scam or Suspicious) | 100.0% (50/50) | 72.0% (36/50) |
| Scam recall, strict (Scam verdict only) | 50/50 | 27/50 |
| False-positive rate (genuine flagged) | 2.0% (1/50) | 4.0% (2/50) |
| Ambiguous inputs given a Scam verdict (must be 0) | 0/0 | 0/0 |
| Ambiguous inputs: Suspicious / No scam signs | 0 / 0 | 0 / 0 |

### By category

| Category | Gemini | Keyword baseline |
|---|---|---|
| bank_alert (7 cases) | 7/7 correctly not flagged | 7/7 correctly not flagged |
| otp (5 cases) | 5/5 correctly not flagged | 5/5 correctly not flagged |
| delivery (5 cases) | 5/5 correctly not flagged | 4/5 correctly not flagged |
| bill (6 cases) | 6/6 correctly not flagged | 6/6 correctly not flagged |
| salary_credit (4 cases) | 4/4 correctly not flagged | 4/4 correctly not flagged |
| appointment (4 cases) | 4/4 correctly not flagged | 4/4 correctly not flagged |
| kyc_reminder (4 cases) | 4/4 correctly not flagged | 3/4 correctly not flagged |
| family_chat (5 cases) | 4/5 correctly not flagged | 5/5 correctly not flagged |
| ecommerce (5 cases) | 5/5 correctly not flagged | 5/5 correctly not flagged |
| govt_notice (3 cases) | 3/3 correctly not flagged | 3/3 correctly not flagged |
| awareness (2 cases) | 2/2 correctly not flagged | 2/2 correctly not flagged |
| realistic_scam (50 cases) | 50/50 flagged (50/50 as Scam) | 36/50 flagged (27/50 as Scam) |

### Scam recall by scam type

| Scam type | Gemini flagged | Keyword baseline flagged |
|---|---|---|
| kyc_update | 4/4 | 4/4 |
| fake_payment | 4/4 | 2/4 |
| qr_receive_scam | 3/3 | 2/3 |
| digital_arrest | 4/4 | 3/4 |
| job_task | 4/4 | 3/4 |
| investment | 4/4 | 3/4 |
| loan_app | 4/4 | 1/4 |
| lottery_prize | 4/4 | 3/4 |
| delivery_customs | 4/4 | 4/4 |
| impersonation_bank | 4/4 | 3/4 |
| phishing_link | 4/4 | 4/4 |
| sextortion | 3/3 | 3/3 |
| other | 4/4 | 1/4 |

### Baseline on the original 50 cases

The keyword baseline scored 100.0% accuracy, 100.0% recall and 0.0% false positives on the 45 text cases of `cases.jsonl` (its rules were tuned on those). Gemini scored 100% on the same set in the 17 Oct run (`results/latest.md`). A simple keyword filter already does well on textbook scams, so the original set could not show what the model adds; the cases above are where the two can differ.

## Latency, errors, retries

- Latency (all successful calls): p50 4.3 s, p95 10.1 s; text only: p50 4.3 s, p95 10.1 s.
- Errors after retries: none.
- Transient errors retried (once each, only for 429 rate_limited, 502, 503, 504): none.

## Every miss, false positive and failure

### v3g40 (family_chat): FALSE POSITIVE

- Message: "Hey, can you lend me Rs 3,000 till Friday? Rent is due and my salary is delayed. I will transfer it back on the 23rd, promise. Call me tonight if you want to talk."
- Trick: friend asking for a short loan
- Gemini: Suspicious, risk 35, type impersonation_bank. It said: "This appears to be a personal request for money, but it could potentially be an impersonation or hacked account attempt. While no overt phishing links or bank threats were detected, unexpected requests for urgent money transfers from contacts require independent verification."
- Red flags raised: Urgent financial request
- Baseline: No scam signs found

### Where the baseline failed and Gemini did not

- v3s07 (realistic_scam, scam): baseline said No scam signs found; message "Sir I have paid Rs 14,500 for the sofa, but the payment shows pending. Please pay Rs 500 back as verification amount to unlock it, then both amounts will get credited together. Screenshot attached."
- v3s08 (realistic_scam, scam): baseline said No scam signs found; message "Aapke GPay par Rs 4,999 cashback aaya hai. Receive karne ke liye request accept karke apna PIN daalein. Offer 24 ghante mein expire hoga."
- v3s10 (realistic_scam, scam): baseline said No scam signs found; message "Sir aapka Rs 6,000 refund ready hai. Neeche diye QR ko scan karein aur PIN enter karein, paisa seedha aapke account mein aayega. QR attached."
- v3s15 (realistic_scam, scam): baseline said No scam signs found; message "Sir, I am ED officer Verma. Your bank account is used in a hawala case. For the investigation you must remain at home with the camera ON. Share your account balance and we will verify it in a supervised account. Non-compliance means an arrest warrant by evening."
- v3s17 (realistic_scam, scam): baseline said No scam signs found; message "Congrats, you completed 3 tasks and earned Rs 450! To unlock the next level and withdraw, deposit Rs 3,000 (refunded with commission Rs 4,200). Join our Telegram group for the next task."
- v3s22 (realistic_scam, scam): baseline said No scam signs found; message "Pre-IPO shares ka mauka! Sirf aaj ke liye institutional quota, 3x return pakka. Rs 25,000 se start karein. Pehle fund transfer karein, allotment kal subah."
- v3s25 (realistic_scam, scam): baseline said No scam signs found; message "You have not repaid the Rs 5,000 loan from the CashNow app. Your contact list has been accessed. We will send your edited photos to all your contacts and relatives tomorrow if you do not pay Rs 9,500 by 5 PM."
- v3s26 (realistic_scam, scam): baseline said No scam signs found; message "Aapka loan approve ho gaya Rs 2,00,000. Insurance aur GST charge Rs 3,500 pehle bhejein, phir paisa aapke account mein aa jayega. Sirf aaj ka offer."
- v3s27 (realistic_scam, scam): baseline said No scam signs found; message "आपने ऐप से लोन लिया था और भुगतान नहीं किया। हम आपके सभी रिश्तेदारों को आपको धोखेबाज़ बताकर मैसेज भेजेंगे। आज ही 7,200 रुपये इस UPI पर भेजें: loanrecovery.cell@oksagar"
- v3s29 (realistic_scam, scam): baseline said No scam signs found; message "बधाई हो! आपका नंबर सन फेस्टिवल लकी ड्रॉ में चुना गया है, आपने एक नई कार जीती है। इनाम पाने के लिए 3,500 रुपये प्रोसेसिंग फीस भेजें।"
- v3s39 (realistic_scam, scam): baseline said No scam signs found; message "Kaveri Bank: your credit card reward points worth Rs 7,250 will lapse tonight. Redeem through the app: kaveribank-rewards.in.net/redeem (install the APK)."
- v3s47 (realistic_scam, scam): baseline said No scam signs found; message "WARNING: your phone has 3 viruses! Call the Mobile Security Helpline 7000095202 immediately. Do not switch off or all your SIM data will be erased. -Technical Support Team"
- v3s48 (realistic_scam, scam): baseline said No scam signs found; message "Help save 6 year old Aarav, who has blood cancer. The hospital needs Rs 4 lakh by Friday. Donate now via UPI hopeforaarav@oksagar. Registered NGO, 80G tax exempt. Please forward to 10 groups and send the payment screenshot."
- v3s50 (realistic_scam, scam): baseline said No scam signs found; message "Flat for rent in Powai, 2BHK at Rs 18,000. I am an army officer posted at Leh, so cannot show it in person. Photos on WhatsApp. Pay a token of Rs 5,000 advance to block the flat and my courier will send the keys."
- v3g13 (delivery, legit): baseline said Scam; message "Zippo Express: your order from CartKing will be delivered today. Share OTP 5521 with the delivery partner only at the time of delivery. Do not share it over a call."
- v3g34 (kyc_reminder, legit): baseline said Suspicious; message "Sagar Bank: aapka KYC update due hai. Apni home branch mein jaakar form bharein ya net banking mein login karke update karein. Kisi ko OTP ya PIN na batayein."

## Scam-list hard signals

No case triggered a scam-list hit or hard signal, so none of these verdicts was list-assisted (`hardSignals` was empty on every row).

## All cases

| id | category | expected | Gemini | risk | type | baseline | result |
|---|---|---|---|---|---|---|---|
| v3g01 | bank_alert | not_flagged | No scam signs found | 10 | none | No scam signs found | pass |
| v3g02 | bank_alert | not_flagged | No scam signs found | 5 | none | No scam signs found | pass |
| v3g03 | bank_alert | not_flagged | No scam signs found | 5 | none | No scam signs found | pass |
| v3g04 | bank_alert | not_flagged | No scam signs found | 10 | none | No scam signs found | pass |
| v3g05 | bank_alert | not_flagged | No scam signs found | 10 | none | No scam signs found | pass |
| v3g06 | bank_alert | not_flagged | No scam signs found | 10 | none | No scam signs found | pass |
| v3g07 | bank_alert | not_flagged | No scam signs found | 5 | none | No scam signs found | pass |
| v3g08 | otp | not_flagged | No scam signs found | 5 | none | No scam signs found | pass |
| v3g09 | otp | not_flagged | No scam signs found | 10 | none | No scam signs found | pass |
| v3g10 | otp | not_flagged | No scam signs found | 10 | none | No scam signs found | pass |
| v3g11 | otp | not_flagged | No scam signs found | 10 | none | No scam signs found | pass |
| v3g12 | otp | not_flagged | No scam signs found | 5 | none | No scam signs found | pass |
| v3g13 | delivery | not_flagged | No scam signs found | 10 | none | Scam (wrong) | pass |
| v3g14 | delivery | not_flagged | No scam signs found | 10 | none | No scam signs found | pass |
| v3g15 | delivery | not_flagged | No scam signs found | 10 | none | No scam signs found | pass |
| v3g16 | delivery | not_flagged | No scam signs found | 5 | none | No scam signs found | pass |
| v3g17 | delivery | not_flagged | No scam signs found | 5 | none | No scam signs found | pass |
| v3g18 | bill | not_flagged | No scam signs found | 10 | none | No scam signs found | pass |
| v3g19 | bill | not_flagged | No scam signs found | 5 | none | No scam signs found | pass |
| v3g20 | bill | not_flagged | No scam signs found | 5 | none | No scam signs found | pass |
| v3g21 | bill | not_flagged | No scam signs found | 10 | none | No scam signs found | pass |
| v3g22 | bill | not_flagged | No scam signs found | 5 | none | No scam signs found | pass |
| v3g23 | bill | not_flagged | No scam signs found | 5 | none | No scam signs found | pass |
| v3g24 | salary_credit | not_flagged | No scam signs found | 5 | none | No scam signs found | pass |
| v3g25 | salary_credit | not_flagged | No scam signs found | 5 | none | No scam signs found | pass |
| v3g26 | salary_credit | not_flagged | No scam signs found | 10 | none | No scam signs found | pass |
| v3g27 | salary_credit | not_flagged | No scam signs found | 5 | none | No scam signs found | pass |
| v3g28 | appointment | not_flagged | No scam signs found | 5 | none | No scam signs found | pass |
| v3g29 | appointment | not_flagged | No scam signs found | 0 | none | No scam signs found | pass |
| v3g30 | appointment | not_flagged | No scam signs found | 5 | none | No scam signs found | pass |
| v3g31 | appointment | not_flagged | No scam signs found | 10 | none | No scam signs found | pass |
| v3g32 | kyc_reminder | not_flagged | No scam signs found | 5 | none | No scam signs found | pass |
| v3g33 | kyc_reminder | not_flagged | No scam signs found | 5 | none | No scam signs found | pass |
| v3g34 | kyc_reminder | not_flagged | No scam signs found | 10 | none | Suspicious (wrong) | pass |
| v3g35 | kyc_reminder | not_flagged | No scam signs found | 10 | none | No scam signs found | pass |
| v3g36 | family_chat | not_flagged | No scam signs found | 0 | none | No scam signs found | pass |
| v3g37 | family_chat | not_flagged | No scam signs found | 0 | none | No scam signs found | pass |
| v3g38 | family_chat | not_flagged | No scam signs found | 5 | none | No scam signs found | pass |
| v3g39 | family_chat | not_flagged | No scam signs found | 5 | none | No scam signs found | pass |
| v3g40 | family_chat | not_flagged | Suspicious | 35 | impersonation_bank | No scam signs found | FAIL |
| v3g41 | ecommerce | not_flagged | No scam signs found | 5 | none | No scam signs found | pass |
| v3g42 | ecommerce | not_flagged | No scam signs found | 5 | none | No scam signs found | pass |
| v3g43 | ecommerce | not_flagged | No scam signs found | 5 | none | No scam signs found | pass |
| v3g44 | ecommerce | not_flagged | No scam signs found | 5 | none | No scam signs found | pass |
| v3g45 | ecommerce | not_flagged | No scam signs found | 5 | none | No scam signs found | pass |
| v3g46 | govt_notice | not_flagged | No scam signs found | 5 | none | No scam signs found | pass |
| v3g47 | govt_notice | not_flagged | No scam signs found | 5 | none | No scam signs found | pass |
| v3g48 | govt_notice | not_flagged | No scam signs found | 5 | none | No scam signs found | pass |
| v3g49 | awareness | not_flagged | No scam signs found | 0 | none | No scam signs found | pass |
| v3g50 | awareness | not_flagged | No scam signs found | 5 | none | No scam signs found | pass |
| v3s01 | realistic_scam | flagged | Scam | 95 | kyc_update | Scam | pass |
| v3s02 | realistic_scam | flagged | Scam | 100 | kyc_update | Scam | pass |
| v3s03 | realistic_scam | flagged | Scam | 98 | kyc_update | Scam | pass |
| v3s04 | realistic_scam | flagged | Scam | 95 | kyc_update | Suspicious | pass |
| v3s05 | realistic_scam | flagged | Scam | 98 | fake_payment | Scam | pass |
| v3s06 | realistic_scam | flagged | Scam | 98 | fake_payment | Scam | pass |
| v3s07 | realistic_scam | flagged | Scam | 95 | fake_payment | No scam signs found (wrong) | pass |
| v3s08 | realistic_scam | flagged | Scam | 98 | fake_payment | No scam signs found (wrong) | pass |
| v3s09 | realistic_scam | flagged | Scam | 95 | qr_receive_scam | Suspicious | pass |
| v3s10 | realistic_scam | flagged | Scam | 95 | qr_receive_scam | No scam signs found (wrong) | pass |
| v3s11 | realistic_scam | flagged | Scam | 100 | qr_receive_scam | Scam | pass |
| v3s12 | realistic_scam | flagged | Scam | 100 | digital_arrest | Scam | pass |
| v3s13 | realistic_scam | flagged | Scam | 98 | digital_arrest | Suspicious | pass |
| v3s14 | realistic_scam | flagged | Scam | 95 | digital_arrest | Suspicious | pass |
| v3s15 | realistic_scam | flagged | Scam | 100 | digital_arrest | No scam signs found (wrong) | pass |
| v3s16 | realistic_scam | flagged | Scam | 95 | job_task | Suspicious | pass |
| v3s17 | realistic_scam | flagged | Scam | 95 | job_task | No scam signs found (wrong) | pass |
| v3s18 | realistic_scam | flagged | Scam | 95 | job_task | Scam | pass |
| v3s19 | realistic_scam | flagged | Scam | 95 | job_task | Suspicious | pass |
| v3s20 | realistic_scam | flagged | Scam | 95 | investment | Scam | pass |
| v3s21 | realistic_scam | flagged | Scam | 95 | investment | Scam | pass |
| v3s22 | realistic_scam | flagged | Scam | 95 | investment | No scam signs found (wrong) | pass |
| v3s23 | realistic_scam | flagged | Scam | 95 | investment | Scam | pass |
| v3s24 | realistic_scam | flagged | Scam | 95 | loan_app | Scam | pass |
| v3s25 | realistic_scam | flagged | Scam | 100 | loan_app | No scam signs found (wrong) | pass |
| v3s26 | realistic_scam | flagged | Scam | 95 | loan_app | No scam signs found (wrong) | pass |
| v3s27 | realistic_scam | flagged | Scam | 95 | loan_app | No scam signs found (wrong) | pass |
| v3s28 | realistic_scam | flagged | Scam | 98 | lottery_prize | Scam | pass |
| v3s29 | realistic_scam | flagged | Scam | 90 | lottery_prize | No scam signs found (wrong) | pass |
| v3s30 | realistic_scam | flagged | Scam | 95 | lottery_prize | Scam | pass |
| v3s31 | realistic_scam | flagged | Scam | 95 | lottery_prize | Scam | pass |
| v3s32 | realistic_scam | flagged | Scam | 95 | delivery_customs | Scam | pass |
| v3s33 | realistic_scam | flagged | Scam | 95 | digital_arrest | Scam | pass |
| v3s34 | realistic_scam | flagged | Scam | 95 | delivery_customs | Scam | pass |
| v3s35 | realistic_scam | flagged | Scam | 95 | delivery_customs | Scam | pass |
| v3s36 | realistic_scam | flagged | Scam | 95 | impersonation_bank | Suspicious | pass |
| v3s37 | realistic_scam | flagged | Scam | 95 | impersonation_bank | Scam | pass |
| v3s38 | realistic_scam | flagged | Scam | 98 | impersonation_bank | Scam | pass |
| v3s39 | realistic_scam | flagged | Scam | 95 | phishing_link | No scam signs found (wrong) | pass |
| v3s40 | realistic_scam | flagged | Scam | 95 | phishing_link | Scam | pass |
| v3s41 | realistic_scam | flagged | Scam | 95 | phishing_link | Scam | pass |
| v3s42 | realistic_scam | flagged | Scam | 95 | phishing_link | Scam | pass |
| v3s43 | realistic_scam | flagged | Scam | 95 | phishing_link | Scam | pass |
| v3s44 | realistic_scam | flagged | Scam | 100 | sextortion | Scam | pass |
| v3s45 | realistic_scam | flagged | Scam | 95 | sextortion | Suspicious | pass |
| v3s46 | realistic_scam | flagged | Scam | 100 | sextortion | Suspicious | pass |
| v3s47 | realistic_scam | flagged | Scam | 95 | other | No scam signs found (wrong) | pass |
| v3s48 | realistic_scam | flagged | Scam | 85 | other | No scam signs found (wrong) | pass |
| v3s49 | realistic_scam | flagged | Scam | 95 | other | Scam | pass |
| v3s50 | realistic_scam | flagged | Scam | 95 | other | No scam signs found (wrong) | pass |

Cases: `eval/cases-v3.jsonl`. Raw results with per-row verdicts, summaries, hard signals and retry log: `eval/results/run-v3.raw.json`.
