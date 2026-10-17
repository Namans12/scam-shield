"""Fills the organisers' AI Builder Cup template with the Scam Shield content.

Usage (from the repo root):
  python scripts/build-deck.py <template.pptx> <out.pptx>

The template is the organisers' own file (File > Download > .pptx from their Google Slides template); it is not
stored in the repo. Benchmark numbers are read from eval/results/latest.md so the deck cannot drift from the evidence.
Every slide of the template is kept (including the template note and the closing slide).
"""
import re
import sys
from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_CONNECTOR, MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Emu, Inches, Pt

ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "docs" / "submission" / "screenshots"
FONT = "Google Sans Flex"
FONT_BOLD = "Google Sans Flex Medium"

INK = RGBColor(0x0B, 0x1F, 0x33)
TEAL = RGBColor(0x0F, 0x76, 0x6E)
TEAL_TINT = RGBColor(0xE6, 0xF4, 0xF1)
GREY = RGBColor(0x5B, 0x67, 0x78)
LINE = RGBColor(0xC9, 0xD3, 0xDD)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
RED = RGBColor(0xB4, 0x23, 0x18)
RED_TINT = RGBColor(0xFD, 0xEC, 0xEB)
AMBER = RGBColor(0x9A, 0x56, 0x00)

REPO_URL = "https://github.com/Namans12/scam-shield"
LIVE_URL = "https://project-91260b43-6705-4176-b71.web.app"
VIDEO_PLACEHOLDER = "[add the demo video link before submitting]"


def read_results() -> dict:
    text = (ROOT / "eval" / "results" / "latest.md").read_text(encoding="utf-8")
    pick = lambda label: re.search(rf"\|\s*{re.escape(label)}[^|]*\|\s*([^|]+?)\s*\|", text).group(1)
    lat = {m.group(1): (m.group(2), m.group(3), m.group(4)) for m in re.finditer(r"\|\s*(text|image|audio)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*(\d+)\s*\|", text)}
    return {
        "accuracy": pick("Accuracy"),
        "recall": pick("Scam recall"),
        "fpr": pick("False-positive rate"),
        "type": pick("Scam type correct"),
        "errors": pick("Errors"),
        "latency": lat,
        "cases": re.search(r"(\d+) synthetic cases: (\d+) scams, (\d+) genuine", text).groups(),
        "false_positives": re.search(r"False positives: (.+)", text).group(1).strip(),
    }


# ---------- helpers ----------
def run_fmt(run, size, bold=False, color=INK, italic=False):
    run.font.name = FONT
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    run.font.color.rgb = color


def text_box(slide, x, y, w, h, paras, size=12, color=INK, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP, name=None, spacing=3):
    """paras: list of str | (str, {size,bold,color}) | list of runs [(text, {opts}), ...]."""
    tb = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    if name:
        tb.name = name
    tf = tb.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    tf.margin_left = tf.margin_right = Inches(0.04)
    tf.margin_top = tf.margin_bottom = Inches(0.02)
    for i, para in enumerate(paras):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        p.space_after = Pt(spacing)
        runs = para if isinstance(para, list) else [para]
        for r in runs:
            t, o = (r, {}) if isinstance(r, str) else r
            run = p.add_run()
            run.text = t
            run_fmt(run, o.get("size", size), o.get("bold", False), o.get("color", color), o.get("italic", False))
    return tb


def box(slide, x, y, w, h, fill=TEAL_TINT, line=None, shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.08, name=None):
    sh = slide.shapes.add_shape(shape, Inches(x), Inches(y), Inches(w), Inches(h))
    if name:
        sh.name = name
    if shape == MSO_SHAPE.ROUNDED_RECTANGLE:
        sh.adjustments[0] = radius
    sh.fill.solid()
    sh.fill.fore_color.rgb = fill
    if line is None:
        sh.line.fill.background()
    else:
        sh.line.color.rgb = line
        sh.line.width = Pt(0.75)
    sh.shadow.inherit = False
    return sh


def label_box(slide, x, y, w, h, title, body=None, fill=TEAL_TINT, title_color=TEAL, size=12, title_size=13, line=None, name=None, align=PP_ALIGN.LEFT):
    box(slide, x, y, w, h, fill=fill, line=line, name=name)
    paras = [(title, {"bold": True, "color": title_color, "size": title_size})]
    if body:
        paras.append((body, {"size": size, "color": INK}))
    return text_box(slide, x + 0.08, y + 0.06, w - 0.16, h - 0.1, paras, size=size, align=align)


def arrow(slide, x1, y1, x2, y2, color=GREY, width=1.5, head=True):
    c = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(x1), Inches(y1), Inches(x2), Inches(y2))
    c.line.color.rgb = color
    c.line.width = Pt(width)
    if head:
        ln = c.line._get_or_add_ln()
        tail = ln.makeelement("{http://schemas.openxmlformats.org/drawingml/2006/main}tailEnd", {"type": "triangle", "w": "med", "len": "med"})
        ln.append(tail)
    return c


def picture(slide, path, x, y, w, h, crop_to_aspect=True):
    """Place a picture inside the (x, y, w, h) frame without distortion; tall images are cropped from the bottom."""
    from PIL import Image
    iw, ih = Image.open(path).size
    frame_ratio, img_ratio = w / h, iw / ih
    pic = slide.shapes.add_picture(str(path), Inches(x), Inches(y), Inches(w), Inches(h))
    if img_ratio < frame_ratio and crop_to_aspect:  # image is taller than the frame: show the top part
        keep = img_ratio / frame_ratio
        pic.crop_bottom = 1 - keep
    elif img_ratio > frame_ratio:  # image is wider than the frame: crop the sides evenly
        keep = frame_ratio / img_ratio
        pic.crop_left = pic.crop_right = (1 - keep) / 2
    pic.line.color.rgb = LINE
    pic.line.width = Pt(0.75)
    return pic


def set_runs(paragraph, parts):
    """Append runs (text, bold) after the paragraph's existing runs, copying the label's font."""
    for text, bold in parts:
        r = paragraph.add_run()
        r.text = text
        r.font.name = FONT_BOLD if bold else FONT
        r.font.size = paragraph.runs[0].font.size
        r.font.color.rgb = INK if bold else GREY


def body_slide(prs, index):
    return prs.slides[index - 1]


def notes(slide, text):
    slide.notes_slide.notes_text_frame.text = text


# ---------- slides ----------
def slide1(prs):
    s = body_slide(prs, 1)
    box_ = next(sh for sh in s.shapes if sh.has_text_frame and "Team name" in sh.text_frame.text)
    answers = {
        "Team name:": "Scam Shield",
        "Team leader name:": "Naman Shrimal",
        "Problem Statement:": "BFSI: Intelligent Risk, Fraud & Financial Experiences. People in India lose thousands of crores to scam messages, QR codes and calls that look real, with no quick way to check them or to turn a scam into action.",
    }
    for p in box_.text_frame.paragraphs:
        for label, ans in answers.items():
            if p.text.strip().startswith(label):
                r = p.add_run()
                r.text = ans
                r.font.name = FONT
                r.font.size = Pt(18 if label != "Problem Statement:" else 13)
                r.font.color.rgb = INK
    # Wrapped lines of the long statement must not run under the template's footer line.
    box_.text_frame.word_wrap = True


def slide3(prs):  # Brief about the idea
    s = body_slide(prs, 3)
    text_box(s, 0.35, 1.38, 5.75, 0.95, [[("Scam Shield checks the thing you were just sent before you act on it: ", {"bold": True, "size": 14, "color": INK}), ("a text, screenshot, QR code, link or voice note.", {"size": 14, "color": INK})]])
    items = [
        ("Verdict you can trust to read", "Scam, Suspicious or No scam signs found, with the red flags quoted from the message, and what to do next. In English or Hindi; Hinglish is understood."),
        ("From a verdict to action", "For a scam: a ready-to-file 1930 / cybercrime.gov.in complaint, a shared scam list so the next person is warned, and a WhatsApp warning card."),
        ("Safe by design", "Links open in an isolated browser, never on the person's phone. It never says \"safe\"; guidance only."),
    ]
    y = 2.3
    for t, b in items:
        label_box(s, 0.35, y, 5.75, 0.95, t, b, size=12)
        y += 1.03
    picture(s, SHOTS / "02-check-mobile.png", 6.5, 1.45, 1.55, 3.35)
    picture(s, SHOTS / "03-result-scam-mobile.png", 8.15, 1.45, 1.55, 3.35)
    text_box(s, 6.4, 4.88, 3.4, 0.5, [("The live app: paste or share, then the verdict with evidence", {"size": 11, "color": GREY})], align=PP_ALIGN.CENTER)


def slide4(prs):  # Opportunities
    s = body_slide(prs, 4)
    tb = next(sh for sh in s.shapes if sh.has_text_frame and "Opportunities" in sh.text_frame.text)
    paras = tb.text_frame.paragraphs
    for p in paras[1:]:  # drop the template's three prompts; the cards below answer each one
        p._p.getparent().remove(p._p)
    tb.height = Inches(0.55)
    box(s, 0.35, 1.3, 9.3, 0.62, fill=RED_TINT)
    text_box(s, 0.45, 1.33, 9.1, 0.58, [[("Rs 19,813 crore", {"bold": True, "size": 18, "color": RED}), ("  reported cyber-fraud losses in 2025  |  about 21.8 lakh complaints (I4C data)", {"size": 12, "color": INK})]], anchor=MSO_ANCHOR.MIDDLE)
    cards = [
        ("How different is it?", [
            "Truecaller Scam Checker (Sep 2026): checks links, numbers and messages against community reports; screenshot upload is only planned, and it has no QR or voice.",
            "Google scam detection: Messages on Pixel 6 and newer; call detection in India on Pixel 9 and newer.",
            "Chakshu: a reporting form; it gives no verdict.",
            "Scam Shield analyses the content itself.",
        ]),
        ("How does it solve the problem?", [
            "Checks before you pay, scan or click, in seconds, in Hindi or English.",
            "Explains every red flag with the exact words from the message.",
            "Turns a scam into action: complaint draft, shared scam list, family warning card.",
        ]),
        ("USP", [
            "Catches scams nobody has reported yet.",
            "UPI-aware: a QR that asks you to pay while the text says receive; fake payment receipts.",
            "Hinglish voice notes (fake police \"digital arrest\" calls).",
            "Link scanning in an isolated browser.",
        ]),
    ]
    x = 0.35
    for title, bullets in cards:
        box(s, x, 2.05, 3.0, 3.35, fill=TEAL_TINT)
        paras = [(title, {"bold": True, "color": TEAL, "size": 14})] + [[("•  ", {"color": TEAL, "size": 12}), (b, {"size": 12})] for b in bullets]
        text_box(s, x + 0.1, 2.12, 2.8, 3.2, paras, spacing=6)
        x += 3.15


def slide5(prs):  # Features
    s = body_slide(prs, 5)
    feats = [
        ("5 input types", "Text, screenshot, QR code, link and voice note."),
        ("Clear verdict", "Scam, Suspicious or No scam signs found, plus a risk score. Never \"safe\"."),
        ("Evidence", "Every red flag quotes the words or part of the image it is based on."),
        ("English + Hindi", "Hinglish understood; answers in the language you pick."),
        ("Complaint draft", "Ready-to-file text for 1930 and cybercrime.gov.in."),
        ("Shared scam list", "\"Reported N times\", with linked numbers, UPI IDs and websites."),
        ("Warning card", "One tap to share a warning to the family WhatsApp group."),
        ("Everyday extras", "Trends, history, one-click examples, installable app, Android share menu, WebMCP agent tools."),
    ]
    cw, ch, gx, gy = 2.25, 1.8, 0.1, 0.1
    for i, (t, b) in enumerate(feats):
        col, row = i % 4, i // 4
        label_box(s, 0.35 + col * (cw + gx), 1.4 + row * (ch + gy), cw, ch, t, b, size=13, title_size=15)


def slide6(prs):  # Process flow
    s = body_slide(prs, 6)
    steps = [
        ("1  Input", "Text, screenshot, QR, link or voice note"),
        ("2  Limits and sign-in", "Anonymous sign-in; per-user, per-IP and daily limits"),
        ("3  Extract", "Phone numbers, UPI IDs, links; QR decoded; OTPs and card numbers blanked"),
        ("4  Scam-list lookup", "Firestore: \"Reported N times\" and linked identifiers"),
        ("5  Isolated link scan", "Private Cloud Run service opens the link; final URL, page text, screenshot"),
        ("6  Gemini verdict", "One structured call reads text, image or audio; evidence quoted"),
        ("7  Hard-signal checks", "Reported scammers and QR pay-vs-receive can only raise the verdict"),
        ("8  Result and actions", "Report, complaint draft, warning card, History"),
    ]
    bw, bh, gap = 2.1, 1.45, 0.3
    for i, (t, b) in enumerate(steps):
        col, row = i % 4, i // 4
        x = 0.35 + col * (bw + gap)
        y = 1.45 + row * (bh + 0.45)
        label_box(s, x, y, bw, bh, t, b, size=12, title_size=13)
        if col < 3:
            arrow(s, x + bw + 0.03, y + bh / 2, x + bw + gap - 0.03, y + bh / 2, color=TEAL, width=2)
    # row 1 -> row 2 connector
    x4, x5 = 0.35 + 3 * (bw + gap) + bw / 2, 0.35 + bw / 2
    y_bottom, y_mid, y_top = 1.45 + bh, 1.45 + bh + 0.22, 1.45 + bh + 0.45
    arrow(s, x4, y_bottom, x4, y_mid, color=TEAL, width=2, head=False)
    arrow(s, x4, y_mid, x5, y_mid, color=TEAL, width=2, head=False)
    arrow(s, x5, y_mid, x5, y_top, color=TEAL, width=2)
    text_box(s, 0.35, 5.0, 9.3, 0.4, [("If Gemini fails or times out, the person sees a clear retry message; no verdict is invented and nothing is stored.", {"size": 11, "color": GREY, "italic": True})], align=PP_ALIGN.CENTER)


def slide7(prs):  # Wireframes
    s = body_slide(prs, 7)
    shots = [("02-check-mobile.png", "Check"), ("03-result-scam-mobile.png", "Result"), ("06-complaint-mobile.png", "Complaint draft"), ("09-check-hindi-mobile.png", "Hindi")]
    w, h, gap = 1.69, 3.65, 0.6
    x = 0.45 + (9.1 - (4 * w + 3 * gap)) / 2
    for f, cap in shots:
        picture(s, SHOTS / f, x, 1.38, w, h)
        text_box(s, x - 0.2, 5.08, w + 0.4, 0.3, [(cap, {"size": 12, "color": GREY})], align=PP_ALIGN.CENTER)
        x += w + gap


def slide8(prs):  # Architecture
    s = body_slide(prs, 8)
    label_box(s, 0.35, 2.5, 1.9, 1.3, "Browser / installed app", "React PWA, English and Hindi", size=11)
    label_box(s, 2.85, 1.4, 2.2, 0.85, "Firebase Hosting", "Web app; /api/** rewrite", size=11)
    box(s, 2.85, 2.45, 2.2, 1.4, fill=TEAL)
    text_box(s, 2.93, 2.51, 2.04, 1.3, [("Cloud Run: API", {"bold": True, "color": WHITE, "size": 13}), ("Limits, extraction, scam-list lookup, hard signals", {"color": WHITE, "size": 11})])
    label_box(s, 2.85, 4.3, 2.2, 0.85, "Firebase Auth", "Anonymous + Google", size=11)
    label_box(s, 6.0, 1.4, 3.65, 0.7, "Gemini on Vertex AI", "Structured verdict from text, image or audio", size=11)
    label_box(s, 6.0, 2.2, 3.65, 0.7, "Firestore", "Scam list, checks, reports, trend counters", size=11)
    label_box(s, 6.0, 3.0, 3.65, 0.95, "Cloud Run: link scanner (private)", "Isolated Chromium behind a validating proxy; zero-role service account", size=11)
    label_box(s, 6.0, 4.3, 1.75, 0.85, "Cloud Storage", "Uploads, deleted after 7 days", size=10)
    label_box(s, 7.9, 4.3, 1.75, 0.85, "Suspicious site", "Never opened on the phone", fill=RED_TINT, title_color=RED, size=10)
    arrow(s, 2.25, 2.85, 2.85, 1.95)
    arrow(s, 3.95, 2.25, 3.95, 2.45)
    arrow(s, 2.25, 3.15, 2.85, 3.15)
    arrow(s, 2.25, 3.5, 2.85, 4.6)
    arrow(s, 5.05, 2.65, 6.0, 1.75)
    arrow(s, 5.05, 2.95, 6.0, 2.55)
    arrow(s, 5.05, 3.3, 6.0, 3.45)
    arrow(s, 5.05, 3.7, 6.0, 4.7)
    arrow(s, 8.8, 3.95, 8.8, 4.3, color=RED)
    text_box(s, 0.35, 5.18, 9.3, 0.28, [("The web app reads its own checks and the public trends from Firestore; uploads go straight to Storage.", {"size": 10, "color": GREY, "italic": True})], align=PP_ALIGN.CENTER)


def slide9(prs):  # Technologies
    s = body_slide(prs, 9)
    label_box(s, 0.35, 1.4, 4.55, 3.9, "Google Cloud and Firebase", None, size=12, title_size=15)
    g = [
        "Gemini on Vertex AI: gemini-3.7-flash, with gemini-2.5-flash as the automatic fallback; text, image and audio in one structured call",
        "Cloud Run: two services (public API, private link scanner)",
        "Firestore: scam list, checks, reports, trends, usage limits",
        "Firebase Authentication (anonymous, Google), Hosting, Storage",
        "Cloud Build and Artifact Registry for deploys; Cloud Text-to-Speech for the voice example",
    ]
    text_box(s, 0.45, 1.85, 4.35, 3.4, [[("•  ", {"color": TEAL, "size": 13}), (t, {"size": 13})] for t in g], spacing=9)
    label_box(s, 5.1, 1.4, 4.55, 3.9, "Application", None, size=12, title_size=15)
    a = [
        "React 18, Vite, Tailwind, Workbox PWA with an Android share target",
        "Node 22, TypeScript, Hono on Cloud Run",
        "Playwright / Chromium for the isolated link scanner",
        "zod schemas shared by web and API; sharp and jsQR for QR decoding",
        "Vitest: over 550 automated tests, plus a 50-case live benchmark",
    ]
    text_box(s, 5.2, 1.85, 4.35, 3.4, [[("•  ", {"color": TEAL, "size": 13}), (t, {"size": 13})] for t in a], spacing=9)


def slide10(prs):  # Estimated cost
    s = body_slide(prs, 10)
    rows = [
        ("Component", "Cost driver", "Note"),
        ("Cloud Run API", "One always-warm instance (1 vCPU, 1 GiB)", "Main fixed cost; avoids cold starts for users and judges"),
        ("Cloud Run link scanner", "Per scan", "Scales to zero when idle"),
        ("Gemini on Vertex AI", "Per check (roughly 2 to 3 thousand input and 500 output tokens)", "Capped by 30 checks per user and 3,000 checks per day"),
        ("Firebase Hosting, Auth, Firestore, Storage", "Usage", "Expected to stay in free tiers at this volume"),
        ("Budget alert", "Rs 1,000 per month", "Alerts at 50%, 90% and 100% of the budget"),
    ]
    tbl = s.shapes.add_table(len(rows), 3, Inches(0.35), Inches(1.45), Inches(9.3), Inches(3.4)).table
    widths = [2.4, 3.5, 3.4]
    for i, wd in enumerate(widths):
        tbl.columns[i].width = Inches(wd)
    for r, row in enumerate(rows):
        for c, val in enumerate(row):
            cell = tbl.cell(r, c)
            cell.text = ""
            p = cell.text_frame.paragraphs[0]
            run = p.add_run()
            run.text = val
            run_fmt(run, 12, bold=(r == 0), color=WHITE if r == 0 else INK)
            cell.fill.solid()
            cell.fill.fore_color.rgb = TEAL if r == 0 else (TEAL_TINT if r % 2 else WHITE)
            cell.margin_left = cell.margin_right = Inches(0.08)
            cell.vertical_anchor = MSO_ANCHOR.MIDDLE
    text_box(s, 0.35, 5.0, 9.3, 0.4, [("Estimates only. Exact figures depend on traffic and current Google Cloud prices; the budget alert is set on the project's billing account.", {"size": 10, "color": GREY, "italic": True})])


def slide11(prs):  # Snapshots
    s = body_slide(prs, 11)
    shots = [
        ("03-result-scam-mobile.png", "Scam verdict with evidence"),
        ("04-result-qr-mobile.png", "QR that asks you to pay"),
        ("10-result-hindi-voice-mobile.png", "Hindi voice note"),
        ("05-result-no-signs-mobile.png", "No scam signs found"),
        ("07-report-dialog-mobile.png", "Report to the scam list"),
    ]
    w, h, gap = 1.62, 3.5, 0.28
    x = 0.45 + (9.1 - (5 * w + 4 * gap)) / 2
    for f, cap in shots:
        picture(s, SHOTS / f, x, 1.4, w, h)
        text_box(s, x - 0.1, 4.95, w + 0.2, 0.45, [(cap, {"size": 10, "color": GREY})], align=PP_ALIGN.CENTER)
        x += w + gap


def slide12(prs, res):  # Performance
    s = body_slide(prs, 12)
    n, ns, ng = res["cases"]
    tiles = [("Accuracy", res["accuracy"]), ("Scam recall", res["recall"]), ("False-positive rate", res["fpr"]), ("Scam type correct", res["type"])]
    x = 0.35
    for lab, val in tiles:
        box(s, x, 1.4, 2.2, 1.05, fill=TEAL_TINT)
        text_box(s, x, 1.43, 2.2, 0.62, [(val, {"bold": True, "size": 26, "color": TEAL})], align=PP_ALIGN.CENTER)
        text_box(s, x, 2.02, 2.2, 0.4, [(lab, {"size": 11, "color": INK})], align=PP_ALIGN.CENTER)
        x += 2.37
    rows = [("Input", "Median", "Slowest 5%", "Cases")]
    for k in ("text", "image", "audio"):
        if k in res["latency"]:
            p50, p95, cnt = res["latency"][k]
            rows.append((k.capitalize(), p50, p95, cnt))
    tbl = s.shapes.add_table(len(rows), 4, Inches(0.35), Inches(2.7), Inches(4.6), Inches(1.6)).table
    for i, wd in enumerate([1.3, 1.1, 1.2, 1.0]):
        tbl.columns[i].width = Inches(wd)
    for r, row in enumerate(rows):
        for c, val in enumerate(row):
            cell = tbl.cell(r, c)
            cell.text = ""
            run = cell.text_frame.paragraphs[0].add_run()
            run.text = str(val)
            run_fmt(run, 11, bold=(r == 0), color=WHITE if r == 0 else INK)
            cell.fill.solid()
            cell.fill.fore_color.rgb = TEAL if r == 0 else (TEAL_TINT if r % 2 else WHITE)
    notes_list = [
        f"{n} synthetic cases ({ns} scams across all 13 scam types, {ng} genuine messages), run one at a time against the live app.",
        f"Errors: {res['errors']}. Genuine message flagged: {res['false_positives']}.",
        "The first run found a real bug (the model did not know today's date and flagged 2026 dates as future); it was fixed and re-measured.",
        "Model choice: an earlier run on gemini-3.8-flash scored 98.0% accuracy and 4.2% false positives, with image checks up to 34 s. It was slow and rate-limited on this project, so the default is gemini-3.7-flash with a fallback.",
        "Small and synthetic: a sanity check, not a guarantee.",
    ]
    text_box(s, 5.2, 2.6, 4.45, 2.85, [[("•  ", {"color": TEAL, "size": 11}), (t, {"size": 11})] for t in notes_list], spacing=4)
    text_box(s, 0.35, 4.45, 4.6, 0.9, [("Slowest 5% is the 95th-percentile time. Image checks vary most because Gemini latency varies.", {"size": 10, "color": GREY, "italic": True})])


def slide13(prs):  # Future development
    s = body_slide(prs, 13)
    items = [
        ("More Indian languages", "Tamil, Telugu, Marathi, Bengali and more."),
        ("Call recordings and on-device checks", "Check a call as it happens; keep private content on the phone."),
        ("Bank and telecom partners", "Feed verified reports into the scam list and push warnings."),
        ("URL reputation feeds", "Add Google Web Risk next to the isolated scan."),
        ("Android app", "Share-sheet and notification checks for SMS and WhatsApp."),
        ("Abuse protection", "Firebase App Check and a stricter per-device limit."),
        ("Google Search grounding", "Switch on for link checks once project quota allows."),
        ("Misinformation mode", "The same engine for \"is this forward real?\"."),
    ]
    cw, ch = 2.25, 1.75
    for i, (t, b) in enumerate(items):
        col, row = i % 4, i // 4
        label_box(s, 0.35 + col * (cw + 0.1), 1.4 + row * (ch + 0.12), cw, ch, t, b, size=12, title_size=13)


def slide14(prs):  # Links
    s = body_slide(prs, 14)
    tb = next(sh for sh in s.shapes if sh.has_text_frame and "Provide links" in sh.text_frame.text)
    for p in tb.text_frame.paragraphs:
        t = p.text.strip()
        suffix = {
            "GitHub Public Repository": REPO_URL,
            "Demo Video Link (3 Minutes)": VIDEO_PLACEHOLDER,
            "Final Product Link": LIVE_URL,
        }.get(t)
        if suffix and p.runs:
            r = p.add_run()
            r.text = f":  {suffix}"
            r.font.name = FONT
            r.font.size = Pt(14)
            r.font.color.rgb = TEAL if suffix.startswith("http") else RED
    tb.height = Inches(1.9)
    tb.width = Inches(9.3)


def main(template: str, out: str) -> None:
    res = read_results()
    prs = Presentation(template)
    slide1(prs)
    slide3(prs)
    slide4(prs)
    slide5(prs)
    slide6(prs)
    slide7(prs)
    slide8(prs)
    slide9(prs)
    slide10(prs)
    slide11(prs)
    slide12(prs, res)
    slide13(prs)
    slide14(prs)
    prs.save(out)
    print("saved", out)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
