# Brief description (for the submission form)

**Scam Shield** lets anyone in India check a suspicious SMS, WhatsApp message, screenshot, QR code, link or voice note before acting on it. It returns a verdict (Scam, Suspicious, or No scam signs found, never "safe"), the red flags with evidence, and next steps, in English or Hindi. For scams it drafts a 1930 / cybercrime.gov.in complaint, adds the scammer's phone, UPI ID or website to a shared scam list ("Reported N times"), and creates a warning card to share on WhatsApp.

**Gemini on Vertex AI** reads text, images and audio in one structured, schema-validated call: it spots fake payment screenshots, transcribes Hinglish "digital arrest" voice notes, and explains each red flag. Our own checks (scam-list hits, a pay QR where the message says "receive") can only raise a verdict.

**Cloud Run** runs two services: the public API, and a private, isolated Chromium link scanner that opens suspicious links so the user never has to.

**Firestore** holds the shared scam list with report counts and linked identifiers, each person's checks, public trend counters, and usage limits.

**Firebase** provides Authentication (anonymous to check, Google sign-in to report), Hosting for the installable web app and API rewrite, and Storage for uploads that auto-delete after 7 days.

On 185 synthetic, author-written test cases run against the live app, it flagged all 90 scams and wrongly flagged 3.3% of 90 genuine messages (98.3% accuracy; 4.5 s median for text): a sanity check, not a guarantee.

**Live app:** https://scam-shield-live.web.app
