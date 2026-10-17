# Demo video script (target 2:45, never over 3:00)

The organisers' rule: the video must be **3 minutes or less** (over-length may be penalised or stop the entry) and must clearly show the **working** solution. Aim for 2:45 so there is margin. Upload as **Public** on YouTube or Vimeo (or a Google Drive link set to "Anyone with the link"), then open the link in a private window to check it.

Record on the live site (phone-width window or a real phone), English UI first. Rehearse once and run each example once beforehand: answers take 5 to 20 s, so cut or speed up the waiting (4x, with a small "sped up" label on screen; never hide a failure). All narration and on-screen text in English; when the Hindi UI is shown, add an English caption. Keep the browser on https://project-91260b43-6705-4176-b71.web.app and do not show HANDOFF.md, DETAILS.md or any billing page.

| Time | Screen | Say |
|---|---|---|
| 0:00-0:12 | Title card, then the landing page | "Indians lost nearly twenty thousand crore rupees to cyber fraud last year, and victims recover about two percent. Scam Shield checks what you were just sent, before you act." (verify the figure before use) |
| 0:12-0:40 | Tap **Fake KYC SMS with a bank link**. Speed up the wait. Result: Scam, red flags with quotes, "Reported 3 times", link-scan screenshot | "A KYC message with a look-alike bank link. Gemini reads it, the link is opened in an isolated browser so I never have to, and the verdict is Scam, with the exact words that give it away. This number was already reported three times." |
| 0:40-1:00 | **QR code to "receive" money**. Result: "This QR asks you to PAY" | "This QR says receive five thousand rupees. Scam Shield decodes it: it is a payment request. You never scan to receive money." |
| 1:00-1:18 | **Voice note: "digital arrest" call**. Show transcript, then verdict | "A fake CBI officer in Hinglish. Gemini transcribes it, spots the arrest threat and the fee demand, and says hang up." |
| 1:18-1:30 | **Fake payment screenshot**; point at the impossible date | "Even a payment screenshot: the date is 31 September and the transaction ID is the wrong length." |
| 1:30-1:55 | **Report this scam** (already signed in with Google, pick a state), **Draft a complaint** (type an amount, Copy), **Share a warning** card | "Then act: report it so the next person is warned, draft the complaint for 1930 or cybercrime.gov.in, and share a warning card with family." |
| 1:55-2:08 | Language toggle to Hindi (English caption: "Everything works in Hindi"), then the Trends page | "It works in Hindi too, and Trends shows what people are reporting." |
| 2:08-2:35 | Architecture diagram (README or slide), then the benchmark numbers | "Gemini on Vertex AI does the analysis. Cloud Run runs the API and the isolated link scanner, Firestore holds the shared scam list, Firebase handles sign-in, hosting and storage. On fifty test cases it flagged every scam, with a four percent false-positive rate." |
| 2:35-2:45 | Closing card with the live link | "Scam Shield: check before you click, pay or scan." |

Drop the Android share-menu clip unless it is recorded on a real phone and works. If something fails on camera, stop and re-record that segment.
