# Brief description (for the submission form)

**Scam Shield** lets anyone in India check a suspicious SMS, WhatsApp message, screenshot, QR code, link or voice note before acting on it. It returns a verdict (Scam, Suspicious, or No scam signs found, never "safe"), the red flags with evidence, and next steps, in English or Hindi. For scams it drafts a 1930 / cybercrime.gov.in complaint, adds the scammer's phone, UPI ID or website to a shared scam list ("Reported N times"), and creates a warning card to share on WhatsApp.

**Gemini on Vertex AI** reads text, images and audio in one structured, schema-validated call: it spots fake payment screenshots, transcribes Hinglish "digital arrest" voice notes, and explains each red flag. Our own checks (scam-list hits, a QR that asks you to pay while the message says "receive") can only raise a verdict.

**Cloud Run** runs two services: the public API, and a private, isolated Chromium link scanner that opens suspicious links so the user never has to.

**Firestore** holds the shared scam list with report counts and linked identifiers, each person's checks, public trend counters, and usage limits (server-only except a user's own checks and public stats).

**Firebase** provides Authentication (anonymous to check, Google sign-in to report), Hosting for the installable web app and API rewrite, and Storage for uploads that auto-delete after 7 days.

On a 50-case benchmark run against the live app, it flagged all 26 scams (100% recall) with a 4.2% false-positive rate and a 4.4 s median for text.
