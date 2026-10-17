// Records the demo footage from the LIVE production site with Playwright (real API calls, nothing mocked).
// Usage:  node capture/record.mjs [scene ...]     (no argument = all scenes)
//   scenes: landing kyc actions qr voice payment hindi mobile
// Each scene is a separate clip (footage/raw/<scene>.webm + .json), so any one can be re-recorded alone.
// Real checks used: kyc, qr, voice, payment, hindi, mobile = 6 per full run (the API allows 60 per minute per IP).
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { launch, newClip, sleep, ROOT, RAW, BASE } from "./lib.mjs";

const scenes = {};
const shareCardOut = resolve(ROOT, "assets/share-card.png");

async function region(clip, label, locator) {
  const box = await locator.boundingBox();
  if (!box) return;
  const vp = clip.page.viewportSize();
  clip.regions ??= {};
  (clip.regions[label] ??= []).push({ t: clip.now(), x: box.x, y: box.y, w: box.width, h: box.height, vw: vp.width, vh: vp.height });
}

/** Records the boxes (viewport coordinates, at this moment) of the elements the video points at. */
async function snap(clip, label) {
  const boxes = await clip.page.evaluate(() => {
    const r = (el) => {
      const b = el.getBoundingClientRect();
      return { x: b.x, y: b.y, w: b.width, h: b.height };
    };
    const vis = (b) => b.y + b.h > 0 && b.y < innerHeight;
    const pick = (els) => els.map(r).filter(vis);
    const q = (sel) => [...document.querySelectorAll(sel)];
    const byText = (re, sel = "span,p,h2,h3,strong,div") => q(sel).filter((e) => e.children.length === 0 && re.test(e.textContent || ""));
    return {
      quote: pick(q("blockquote")),
      flag: pick(q("section li:has(h3)")),
      badge: pick(byText(/^Reported \d+ times?$|^\d+ बार रिपोर्ट/)),
      hit: pick(q("section li:has(.font-mono), section li:has(code)")),
      img: pick(q("article img")),
      verdict: pick(q("article > div")),
      qr: pick(byText(/This QR asks you to PAY/).map((e) => e.closest("[class*='rounded']") ?? e)),
      group: pick(q("[role='group']")),
      details: pick(q("details")),
      dialog: pick(q("[role='dialog']")),
      dialogNote: pick(q("[role='dialog'] form > div")),
      input: pick(q("input:not([type='hidden']), select")),
      textarea: pick(q("textarea")),
      copy: pick(byText(/^(Copy text|Copied)$/, "span").map((e) => e.closest("button") ?? e)),
      reportBtn: pick(byText(/^Report this scam$/, "span").map((e) => e.closest("button") ?? e)),
      shareBtn: pick(byText(/^Share a warning$/, "span,button").map((e) => e.closest("button") ?? e)),
    };
  });
  clip.snaps ??= [];
  clip.snaps.push({ label, t: clip.now(), boxes });
}

/** Moves the pointer out of the content column so it never covers the evidence. */
const park = (clip) => clip.moveTo(1310, 470, 900);

/** Scrolls an element near the top of the viewport, waits, records its box (viewport coordinates) and holds. */
async function showSection(clip, label, locator, { offset = 110, hold = 2200, ms = 1500 } = {}) {
  await clip.scrollToEl(locator, { offset, ms });
  await sleep(500);
  clip.mark(label);
  await region(clip, label, locator);
  await snap(clip, label);
  await sleep(hold);
}

const h2 = (page, name) => page.getByRole("heading", { level: 2, name });

/** Runs the whole example flow: /check -> scroll to examples -> click -> wait -> result page. */
async function runExample(clip, id) {
  const { page } = clip;
  await clip.goto("/check");
  await clip.moveTo(900, 420, 900);
  await sleep(1100);
  await clip.scrollToEl(page.locator("#examples-title"), { offset: 120, ms: 1500 });
  await sleep(500);
  const btn = page.locator(`[data-example="${id}"]`);
  clip.mark("examples-visible");
  await clip.moveToEl(btn);
  await sleep(500);
  await clip.click(btn);
  clip.mark("click");
  await clip.waitForResult();
  clip.mark("result");
  await sleep(700);
}

scenes.landing = async (b) => {
  const c = await newClip(b, "landing");
  const { page } = c;
  await c.goto("/");
  await sleep(2600);
  c.mark("hero");
  await c.moveTo(1050, 480, 1100);
  await sleep(1800);
  await c.moveTo(560, 640, 900);
  await sleep(900);
  // The deployed landing page still has a statistics strip that carries a recovery percentage we do not stand behind
  // (see docs/submission/sources.md). The video never shows it: jump (instantly) past the strip, then scroll smoothly.
  const strip = page.getByText(/recovered/i).first();
  if (await strip.count()) {
    const bottom = await strip.evaluate((el) => (el.closest("aside") ?? el).getBoundingClientRect().bottom + window.scrollY);
    await page.evaluate((y) => window.scrollTo(0, y), Math.ceil(bottom + 40));
  } else {
    await page.evaluate(() => window.scrollTo(0, 900));
  }
  await c.moveTo(700, 560, 500);
  await sleep(1200);
  c.mark("scroll-start");
  await c.scrollBy(700, 2200);
  await sleep(1400);
  await c.scrollBy(800, 2400);
  await sleep(1400);
  c.mark("scroll-end");
  await c.finish();
};

scenes.kyc = async (b) => {
  const c = await newClip(b, "kyc");
  const { page } = c;
  await runExample(c, "kyc_sms");
  await park(c);
  c.mark("verdict");
  await region(c, "verdict", page.locator("article > div").first());
  await snap(c, "verdict");
  await sleep(2600);
  await showSection(c, "redflags", h2(page, "Warning signs").locator(".."), { offset: 100, hold: 3200 });
  await c.scrollBy(380, 1300);
  await sleep(2200);
  c.mark("redflags2");
  await showSection(c, "nextsteps", h2(page, "What to do now").locator(".."), { offset: 100, hold: 2000 });
  await showSection(c, "hits", h2(page, "Reported before").locator(".."), { offset: 100, hold: 2800 });
  await showSection(c, "linkscan", h2(page, "Where the link leads").locator(".."), { offset: 100, hold: 1800 });
  await c.scrollBy(500, 1400);
  await sleep(2800);
  c.mark("linkscan2");
  await c.finish({ keepState: true });
};

scenes.actions = async (b) => {
  const kyc = JSON.parse(readFileSync(resolve(RAW, "kyc.json"), "utf8"));
  const path = new URL(kyc.url).pathname;
  const c = await newClip(b, "actions", { storageState: resolve(RAW, "kyc.state.json") });
  const { page } = c;
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
  await c.goto(path);
  await page.getByRole("heading", { level: 1 }).waitFor({ timeout: 20_000 });
  await sleep(1500);
  const verdictOk = await page.getByRole("heading", { level: 1 }).first().textContent();
  if (/no longer/i.test(verdictOk ?? "")) throw new Error("result not available to the stored session");
  c.mark("loaded");
  await c.moveTo(1000, 480, 700);
  // The action bar sits below the result sections.
  const bar = page.getByRole("group", { name: /actions|next/i }).first();
  const reportBtn = page.getByRole("button", { name: "Report this scam" });
  await c.scrollToEl(reportBtn, { offset: 520, ms: 2400 });
  await sleep(900);
  c.mark("bar");
  await region(c, "bar", reportBtn.locator(".."));
  await snap(c, "bar");
  await sleep(1200);
  // 1) Report dialog (never sign in).
  await c.click(reportBtn);
  c.mark("report-open");
  await sleep(800);
  const dlg = page.getByRole("dialog");
  await region(c, "dialog", dlg);
  await snap(c, "dialog");
  await sleep(4200);
  c.mark("report-held");
  await page.keyboard.press("Escape");
  await sleep(900);
  // 2) Share a warning: the OS share sheet cannot be recorded, so a minimal navigator.share stand-in only captures the
  //    PNG that the app's own renderer produced for this real result.
  await page.evaluate(() => {
    navigator.canShare = () => true;
    navigator.share = async (d) => {
      const f = d.files && d.files[0];
      if (!f) return;
      const url = await new Promise((res) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.readAsDataURL(f);
      });
      window.__card = url;
    };
  });
  const shareBtn = page.getByRole("button", { name: "Share a warning" });
  await c.click(shareBtn);
  c.mark("share-click");
  const card = await page.waitForFunction(() => window.__card, null, { timeout: 15_000 }).then((h) => h.jsonValue());
  mkdirSync(resolve(ROOT, "assets"), { recursive: true });
  writeFileSync(shareCardOut, Buffer.from(String(card).split(",")[1], "base64"));
  await sleep(1500);
  c.mark("share-done");
  // 3) Draft a complaint.
  await c.click(page.getByRole("link", { name: "Draft a complaint" }));
  await page.waitForSelector("#c-amount", { timeout: 20_000 });
  await sleep(1200);
  c.mark("complaint");
  await region(c, "complaint-form", page.locator("#c-amount").locator("../.."));
  await c.type(page.locator("#c-amount"), "50000", 140);
  await sleep(1200);
  c.mark("amount-typed");
  await snap(c, "amount-typed");
  const draft = page.getByRole("textbox", { name: "Your complaint draft" });
  await c.scrollToEl(draft, { offset: 140, ms: 1600 });
  await sleep(1800);
  c.mark("draft");
  await region(c, "draft", draft);
  await snap(c, "draft");
  const copyBtn = page.getByRole("button", { name: "Copy text" });
  await c.click(copyBtn);
  c.mark("copied");
  await region(c, "copy", page.getByRole("button", { name: /Copied|Copy text/ }));
  await snap(c, "copied");
  await sleep(2400);
  await c.finish();
};

scenes.qr = async (b) => {
  const c = await newClip(b, "qr");
  const { page } = c;
  await runExample(c, "qr_receive");
  await park(c);
  c.mark("verdict");
  await region(c, "verdict", page.locator("article > div").first());
  await snap(c, "verdict");
  await sleep(2400);
  const qrTitle = page.getByRole("heading", { level: 2, name: "QR code" });
  await showSection(c, "qr", qrTitle.locator(".."), { offset: 90, hold: 4200, ms: 2200 });
  await region(c, "qr-pay", page.getByText("This QR asks you to PAY").locator("xpath=ancestor::*[contains(@class,'rounded')][1]"));
  await c.finish();
};

scenes.voice = async (b) => {
  const c = await newClip(b, "voice");
  const { page } = c;
  await runExample(c, "digital_arrest");
  await park(c);
  c.mark("verdict");
  await region(c, "verdict", page.locator("article > div").first());
  await snap(c, "verdict");
  await sleep(2400);
  const summary = page.locator("details > summary").first();
  await c.scrollToEl(summary, { offset: 160, ms: 1500 });
  await sleep(600);
  await c.click(summary);
  c.mark("transcript-open");
  await sleep(500);
  await region(c, "transcript", page.locator("details").first());
  await snap(c, "transcript");
  await sleep(4800);
  c.mark("transcript-held");
  await showSection(c, "redflags", h2(page, "Warning signs").locator(".."), { offset: 100, hold: 3200 });
  await c.finish();
};

scenes.payment = async (b) => {
  const c = await newClip(b, "payment");
  const { page } = c;
  await runExample(c, "fake_payment");
  await park(c);
  c.mark("verdict");
  await region(c, "verdict", page.locator("article > div").first());
  await snap(c, "verdict");
  await sleep(2400);
  // The three warning signs (impossible date, mismatched sender, wrong transaction-reference length) stay in view together.
  await showSection(c, "redflags", h2(page, "Warning signs").locator(".."), { offset: 100, hold: 8200 });
  c.mark("flags-end");
  await c.finish();
};

scenes.hindi = async (b) => {
  const c = await newClip(b, "hindi");
  const { page } = c;
  await c.goto("/check");
  await sleep(1400);
  await c.moveTo(900, 420, 800);
  await sleep(900);
  const toggleHi = page.getByRole("radio", { name: "हिंदी" }).first();
  await c.click(toggleHi);
  c.mark("hindi-on");
  await region(c, "toggle", page.locator(".language-toggle").first());
  await sleep(2600);
  await c.scrollToEl(page.locator("#examples-title"), { offset: 120, ms: 1500 });
  await sleep(600);
  const btn = page.locator('[data-example="kyc_sms"]');
  await c.click(btn);
  c.mark("click");
  await c.waitForResult();
  c.mark("result");
  await park(c);
  await region(c, "verdict", page.locator("article > div").first());
  await snap(c, "verdict");
  await sleep(3800);
  await c.scrollBy(520, 1600);
  await sleep(2600);
  c.mark("hindi-flags");
  await snap(c, "hindi-flags");
  // Trends, still in Hindi.
  await c.click(page.locator('a[href="/trends"]').first());
  await page.waitForTimeout(1500);
  c.mark("trends");
  await c.moveTo(980, 520, 700);
  await sleep(2600);
  await c.scrollBy(520, 1600);
  await sleep(2600);
  c.mark("trends2");
  await c.scrollBy(-520, 1000);
  await c.click(page.getByRole("radio", { name: "English" }).first());
  c.mark("english-back");
  await sleep(2400);
  await c.finish();
};

scenes.mobile = async (b) => {
  const c = await newClip(b, "mobile", { mobile: true });
  const { page } = c;
  await c.goto("/check");
  await sleep(1500);
  await page.locator("#examples-title").scrollIntoViewIfNeeded();
  await sleep(1200);
  c.mark("examples-visible");
  await page.locator('[data-example="kyc_sms"]').click();
  c.mark("click");
  await c.waitForResult();
  c.mark("result");
  await sleep(2600);
  for (let i = 0; i < 4; i++) {
    await page.mouse.move(195, 500);
    await c.scrollBy(520, 1400);
    await sleep(1800);
    c.mark(`scroll${i}`);
  }
  await c.finish();
};

const wanted = process.argv.slice(2);
const names = wanted.length ? wanted : Object.keys(scenes);
const browser = await launch();
for (const name of names) {
  if (!scenes[name]) throw new Error(`unknown scene ${name}`);
  console.log(`== ${name}`);
  try {
    await scenes[name](browser);
  } catch (e) {
    console.error(`!! ${name} FAILED: ${e.message}. Not used: record it again.`);
    process.exitCode = 1;
  }
}
await browser.close();
