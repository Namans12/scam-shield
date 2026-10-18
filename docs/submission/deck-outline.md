# Deck content, slide by slide

The deck uses the organisers' prescribed template (all 16 slides, in order, with their header and footer images and titles) and is exported to PDF (under 5 MB, exactly 16 pages).

Rebuild: `scripts/build-deck.sh` (reads `docs/submission/template-base.pptx`, reads the benchmark numbers from `eval/results/latest.md` and `eval/results/run-hindi.md`, writes `Scam-Shield-deck.pptx`, exports `Scam-Shield-deck.pdf` with PowerPoint). Run it again after the benchmark files or the video link change. To fill in the video link: `DECK_VIDEO_URL=https://... scripts/build-deck.sh`.

`template-base.pptx` is the organisers' file with everything the build script adds removed (the original file is no longer available). The three sub-prompts on slide 4 were lost with it; the cards on that slide use the organisers' standard wording.

Every statistic is listed in `sources.md`. Cost figures are labelled estimates, with the prices and the arithmetic in the slide 10 speaker notes. Speaker notes on every slide carry the sources and assumptions.

1. **Team details.** Team name Scam Shield, leader Naman Shrimal, track "BFSI: Intelligent Risk, Fraud & Financial Experiences", the problem and the community benefit; logo.
2. Template note (untouched).
3. **Brief about the idea.** One multimodal Gemini call, a verdict you can check (evidence quoted, English or Hindi), from verdict to action; landing and result screenshots in phone frames.
4. **Opportunities.** Rs 19,813 crore reported lost in 2025, about 21.78 lakh complaints (I4C data); how it differs (Truecaller Scam Checker, Google scam detection, Chakshu, exactly as in `sources.md`); how it solves the problem; USP. No recovery percentage.
5. **Features.** Eight icon cards (input types, verdict, evidence, languages, complaint draft, shared scam list, warning card, WebMCP agent tools) and the everyday extras.
6. **Process flow.** Eight steps; the Gemini step is highlighted; a Gen AI band says what Gemini does that rules cannot and that hard checks only raise a verdict.
7. **Wireframes.** Real screenshots: desktop check page, mobile check, complaint draft, Hindi.
8. **Architecture.** Person, Firebase Hosting and Auth, Cloud Run API (stateless, 1 to 5 instances, one warm), Gemini on Vertex AI, Firestore, private link scanner on Cloud Run (scales to zero, zero-permission service account), Cloud Storage (7-day deletion), limits, with the official Google logos.
9. **Technologies.** Gen AI panel (Gemini 3.7 Flash with 2.5 Flash fallback, multimodal call, schema-validated output with evidence, hard checks that only raise, WebMCP), Google Cloud and Firebase for scale, application stack, 590+ tests.
10. **Estimated cost.** Fixed (one warm Cloud Run instance, about US$13 per month), per check (Gemini, about US$0.004 to 0.008, with stated token assumptions and Google's published prices), free tiers, and the limits and budget alert that bound the bill.
11. **Prototype snapshots.** Five phone screenshots: scam, QR, no scam signs found, Hindi voice note, report dialog.
12. **Performance report.** Combined English runs (accuracy, scam recall, false-positive rate, type accuracy), latency table with the Hindi run, the combined result over 185 synthetic cases (98.3% accuracy, 100% of 90 scams flagged, 3.3% of 90 genuine messages wrongly flagged), plainly "synthetic, author-written, a sanity check, not a guarantee", the model used, and the bug the first run found.
13. **Future development.** More Indian languages, bank and telecom partnerships, URL reputation feeds, Android app, Google Search grounding, call-recording upload; and how it scales.
14. **Links.** GitHub, demo video (clearly marked placeholder for the owner), live product (https://scam-shield-live.web.app), and a QR code to the live app.
15. Closing slide with the logo and the tagline.
16. Template "Thank you" slide (untouched).
