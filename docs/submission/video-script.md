# Demo video: script of the shipped video (2:48, limit 3:00)

The organisers' rule: the video must be **3 minutes or less** and must clearly show the **working** solution. The shipped video is **2:48** (168.5 s). It is built by code (`video/`), so this file describes what the video says and shows; it is not a recording brief. The exact words are in `video/narration/narration.json` (the spoken text and the burned-in captions), the scene timing in `video/narration/timings.json`, and how to re-record or re-voice in `video/README.md`.

Upload as **Public** on YouTube or Vimeo (or a Google Drive link set to "Anyone with the link"), open the link in a private window to check it, then add the link to `README.md` and deck slide 14.

## What the video is

- Real footage of the live site (https://scam-shield-check.web.app; the older default URL also works) recorded with Playwright doing real checks. Nothing in the app UI is mocked. Each window carries a "Real recording of the live app" tag.
- English voice-over from Google Cloud Text-to-Speech, with captions burned in. When the Hindi interface is shown, the captions are in English.
- Waiting for Gemini is sped up exactly 4x, with a "Sped up 4x" badge on screen the whole time. A failed check aborts the recording, so it is recorded again rather than hidden.
- "Reported 3 times" and the Trends page come from demo data pre-loaded in the shared scam list; the video says so on screen and in the narration.
- It never calls anything "safe", and it makes no claim about how much money victims recover.

## Scenes, in order

Narration length is the length of the voice-over for that scene (from `timings.json`); the scenes together run 2:48 including short pauses and cross-fades.

| Scene | Narration | What is on screen | What the voice says (abridged; full text in `narration.json`) |
|---|---|---|---|
| Intro | 8.8 s | Logo and name, then the reported-losses figure with its source (I4C data) | "Indians reported nearly twenty thousand crore rupees lost to cyber fraud in twenty twenty-five. Scam Shield checks what you were just sent, before you act." (the figure is about Rs 19,813 crore reported to I4C for 2025; see `sources.md`) |
| Landing | 7.3 s | The landing page | Paste a message, or add a screenshot, a QR code, a link or a voice note; English, Hindi and Hinglish are understood. |
| KYC message | 28.0 s | One tap on the fake KYC example runs a real check (wait sped up 4x). Verdict, risk score and scam type; red flags with the quoted words; "Reported 3 times"; the link-scan screenshot of the fake bank form | A fake KYC message with a look-alike bank link. The verdict is Scam. Every warning sign quotes the exact words that give it away. The number and the link are already on the shared scam list: in this demo, three reports each. The link was opened in an isolated browser, so you see the fake bank form without opening it yourself. |
| QR code | 14.9 s | The "receive Rs 5,000" QR example; the card showing the decoded payment request and the payee UPI ID | The QR says you will receive Rs 5,000; decoded on the server, it is a payment request. You never scan a code to receive money. |
| Voice note | 14.9 s | A synthetic Hinglish "fake CBI officer" voice note; the transcript; verdict Scam, digital arrest | Gemini writes down what was said, spots the arrest threat and the fee demand, and says to hang up. |
| Payment screenshot | 16.6 s | A fake payment screenshot; the red flags | A buyer says they have paid. The date is 31 September, which does not exist; the transaction reference has the wrong length; the sender name does not match the UPI ID. |
| Act | 17.5 s | The Report, Complaint and Share bar; the Report dialog opening and asking for Google sign-in (the sign-in itself is not shown); the complaint draft with an amount typed in, then Copy; the share card the app generated | To report it, sign in with Google, then add the scammer's number to the shared list. Draft the complaint for 1930 or the cybercrime portal. Share a warning card with family. |
| Phone | 6.2 s | A phone-sized window: one tap runs a check; the bottom bar | It fits a phone screen too. |
| Hindi and Trends | 14.7 s | Switch to Hindi, run the check, verdict in Hindi (English caption); the Trends page, labelled as including demo data | It works in Hindi too; the Trends page shows reports by scam type and state, with demo data while the app is new. |
| Architecture | 16.4 s | Animated diagram: browser, Firebase Hosting, Cloud Run API, Firestore, isolated link scanner, Gemini on Vertex AI, Firebase Auth and Storage; trademark footnote | Hosting serves the app and forwards API calls to Cloud Run. It checks the Firestore scam list, sends any link to a separate isolated scanner, and asks Gemini on Vertex AI for a structured verdict. Firebase handles sign-in and file storage. |
| Benchmark | 9.8 s | The benchmark numbers read from `eval/results/latest.md`, with the caveat on screen | "On fifty synthetic test cases, Scam Shield flagged all twenty-six scams, and wrongly flagged none of the twenty-four genuine messages. It is a small test, not a guarantee." |
| Closing | 4.2 s | Closing card with the live link and the repository | "Scam Shield. Check before you click, pay or scan." |

## Numbers the video uses

All come from `eval/results/latest.md` (run on 17 Oct 2026 against the live app, `gemini-3.7-flash`): 50 synthetic cases, 26 scams and 24 genuine messages, every scam flagged, 0 of 24 genuine messages flagged (false-positive rate 0.0%). The narration sentence is generated from that file by `video/scripts/bench.mjs`, so it follows the file when the benchmark is re-run.

## Before you re-render or replace it

- Keep the total under 3:00 (`npm run verify` in `video/` fails above 175 s).
- If you record your own voice, follow "Using your own voice" in `video/README.md`; the sentences to read are in `video/narration/narration.resolved.json`.
- To show a real Google sign-in in the Report scene, drop an 8 second clip at `video/assets/owner-report-clip.mp4` (see `video/README.md`); without it the video shows the dialog only, and does not claim a sign-in happened.
- Do not show `HANDOFF.md`, `DETAILS.md` or any billing page on screen.
