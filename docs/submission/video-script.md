# Demo video script (target 3:30, hard limit 4:00)

Record on the live site, phone-width window or a real phone, English UI first. Rehearse once; every example takes 5 to 20 s to answer, so talk through the wait. Keep the browser on https://project-91260b43-6705-4176-b71.web.app. Do not show HANDOFF.md or any console page that shows billing.

| Time | Screen | Say |
|---|---|---|
| 0:00-0:20 | Title card, then the Check page | "Indians lost nearly twenty thousand crore rupees to cyber fraud last year, and victims recover about two percent. Scam Shield checks the thing you were just sent, before you act on it." |
| 0:20-0:55 | Tap **Fake KYC SMS with a bank link**. While it runs, point at the "Checking" status. Result: Scam, risk 98, red flags | "A classic KYC message with a look-alike bank link. It reads the text, opens the link in an isolated browser so I never have to, and says: Scam. Here are the warning signs, each with the exact words from the message. And note: Reported three times. Other people already flagged this number and site." Scroll to the link-scan screenshot. |
| 0:55-1:25 | Back, tap **QR code to "receive" money**. Result: Scam, "This QR asks you to PAY" | "This QR says receive five thousand rupees. Scam Shield decodes it: it is actually a payment request. You never scan a QR to receive money." |
| 1:25-1:55 | Tap **Voice note: "digital arrest" call**. Show the transcript, then the verdict | "A fake CBI officer in Hinglish. Gemini transcribes it, spots the arrest threat, the secrecy and the fee, and tells me to hang up." |
| 1:55-2:15 | Tap the **fake payment screenshot** example; point at the impossible date | "Even a payment screenshot: the date is 31 September and the transaction ID is the wrong length." |
| 2:15-2:55 | On a scam result: **Report this scam** (sign in with Google, pick state, add), then **Draft a complaint** (type an amount, tap Copy), then **Share a warning** and show the card | "If it's a scam: report it so the next person is warned, draft the complaint for 1930 or cybercrime.gov.in, and share a warning card to the family WhatsApp group." |
| 2:55-3:10 | Tap the **हिं** toggle, run an example in Hindi | "Everything works in Hindi." |
| 3:10-3:25 | **Trends** page, then the Android share-menu clip if available | "Trends shows what people are reporting. On Android you can share a WhatsApp message straight to the app." |
| 3:25-3:50 | Architecture diagram (README or slide 8) | "Gemini on Vertex AI does the analysis; Cloud Run runs the API and the isolated link scanner; Firestore holds the shared scam list; Firebase gives sign-in, hosting and storage. On fifty test cases it caught every scam with a four percent false-positive rate." |
| 3:50-4:00 | Closing card with the live link | "Scam Shield: check before you click, pay or scan." |

If an example is slow on the day, run it once before recording so the result is quick to reproduce, and keep going while it loads. If something fails on camera, stop and re-record that segment; do not hide a failure.
