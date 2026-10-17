# Deck content, slide by slide (use the organisers' prescribed template exactly: submissions that do not follow it may be disqualified; export PDF under 5 MB)

Numbers marked (est.) are estimates to confirm in the billing console before the deck goes out.

1. **Team details.** Team name, leader (Naman), problem statement: "People in India are tricked by messages, QR codes and calls that look real, and there is no quick way to check them or to turn a scam into action."
2. Template note (leave as is).
3. **Brief about the idea.** Check any suspicious text, screenshot, QR, link or voice note; get a verdict, evidence and next steps in English or Hindi; for scams, a complaint draft, a shared scam list and a warning card.
4. **Opportunities.** Rs 19,813 crore reported cyber-fraud losses in 2025, about 21.8 lakh complaints (I4C), about 2% recovered. *How it differs:* Truecaller Scam Checker (Sep 2026) matches known reports and has no screenshots, QR or voice; Google's scam detection is mostly Pixel-only; Chakshu is a reporting form with no verdict. *USP:* analyses the content itself (catches unreported scams), UPI-aware (QR pay versus receive, fake receipts), Hinglish voice, safe link scanning, and turns a verdict into action.
5. **Features.** Five input types; verdict with evidence; Hindi and English; complaint draft; shared scam list ("Reported N times"); WhatsApp warning card; trends; history; examples; installable with Android share target; WebMCP tools.
6. **Process flow.** Input, then limits and sign-in, then extract phones, UPIs, links and QR, then scam-list lookup, then isolated link scan, then Gemini verdict, then hard-signal checks, then result and actions (report, complaint, share).
7. **Wireframes.** Use `docs/submission/screenshots/02-check-mobile.png` and `03-result-scam-mobile.png`.
8. **Architecture.** The Mermaid diagram from the README (export as an image).
9. **Technologies.** Gemini on Vertex AI, Cloud Run (two services), Firestore, Firebase Auth, Hosting and Storage; React, Vite, Tailwind, Hono, Playwright, Workbox.
10. **Estimated cost (est.).** Cloud Run API with one warm instance is the main fixed cost; link scanner scales to zero; Firebase Hosting, Auth, Firestore and Storage at this volume sit in free tiers; Gemini Flash is a per-check cost (roughly 2 to 3 thousand input tokens and 500 output tokens per check; multiply by the current Flash price in the billing console). Daily caps: 30 checks per user and 3,000 in total.
11. **Prototype snapshots.** `docs/submission/screenshots/` (03 result, 04 QR, 05 no signs, 06 complaint, 07 report, 08 trends, 10 Hindi voice note, 11 share card).
12. **Performance report.** Table from `eval/results/latest.md`: accuracy 100%, scam recall 100% (26/26), false-positive rate 0% (0/24), type accuracy 96.2%, text p50 4.5 s / p95 12.9 s, image p50 8.9 s (p95 9.5 s), audio p50 14.2 s. 50 synthetic cases, one run at a time against the live app. Note the date bug the benchmark found and fixed, and that the earlier gemini-3.8-flash run (98.0% / 100% / 4.2%) is kept for comparison.
13. **Future development.** More Indian languages; call-recording upload and on-device checks; bank and telecom partnerships to feed verified reports; Web Risk and URL reputation feeds; Android app with SMS and notification sharing; misinformation mode; Google Search grounding once quota allows.
14. **Links.** GitHub: https://github.com/Namans12/scam-shield . Live: https://project-91260b43-6705-4176-b71.web.app . Demo video: _add link_.
15-16. Leave blank (template).


## Add to the existing deck (judging asks for feasibility and scalability, explained in detail)

The criteria weigh **Technical merit and Gen AI 40%**, problem alignment and impact 25%, innovation 25%, UX 10%. Make these points explicit (they are not all in the current PDF; check it):

- **Meaningful Gen AI (slides 3, 6, 9):** one multimodal Gemini call reads text, screenshots and audio (Hinglish transcription); structured, schema-validated output; every red flag quotes evidence from the input; answers in English or Hindi; deterministic checks (scam-list hits, QR pay-versus-receive) can only raise a verdict, never lower it. Say what Gemini does that rules cannot: catch unreported scams and read an image or a voice note.
- **Feasibility and scalability (slides 9, 10, 13):** stateless API on Cloud Run (autoscaling, one warm instance), the link scanner scales to zero, Firestore for the shared scam list and counters, Firebase Hosting in front; per-user, per-IP and global daily limits bound cost; a rough per-check cost; storage auto-deletes uploads after 7 days. Roadmap: partnerships with banks and telecoms to feed verified reports, Web Risk and URL reputation feeds, more Indian languages, an Android app with SMS and notification sharing.
- **Evidence (slide 12):** the 50-case benchmark (English 98% accuracy, 100% scam recall, 4.2% false positives; Hindi run in `eval/results/run-hindi.md`), and say plainly that it is small and synthetic.
- **Problem statement (slide 1):** name it exactly as "BFSI: Intelligent Risk, Fraud & Financial Experiences". Also mention the community benefit (people who lose savings to scams).
- Every statistic or competitor claim (I4C figures, Truecaller, Google scam detection, Chakshu) needs a source on the slide notes; the numbers were taken from earlier research and have not been re-verified.
