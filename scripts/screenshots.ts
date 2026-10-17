// Captures the deck/README screenshots from the live site (real checks, so it costs a few Gemini calls).
// Usage: npx tsx scripts/screenshots.ts [baseUrl]   -> docs/submission/screenshots/*.png
import { chromium, type Page } from "playwright";
import { build } from "esbuild";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, "docs/submission/screenshots");
const BASE = (process.argv[2] ?? "https://project-91260b43-6705-4176-b71.web.app").replace(/\/$/, "");
mkdirSync(out, { recursive: true });

const shot = (page: Page, name: string, full = false) => page.screenshot({ path: `${out}/${name}.png`, fullPage: full });
const waitResult = (page: Page) => page.waitForURL(/\/result\//, { timeout: 70_000 }).then(() => page.waitForTimeout(1200));

async function newPage(browser: Awaited<ReturnType<typeof chromium.launch>>, opts: { mobile: boolean; lang: "en" | "hi" }) {
  const ctx = await browser.newContext(
    opts.mobile
      ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: "light" }
      : { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, colorScheme: "light" },
  );
  await ctx.addInitScript((l) => localStorage.setItem("scamshield:lang", l), opts.lang);
  return { ctx, page: await ctx.newPage() };
}

const browser = await chromium.launch();

// 1. Desktop: check page and trends.
{
  const { ctx, page } = await newPage(browser, { mobile: false, lang: "en" });
  await page.goto(BASE);
  await page.waitForTimeout(1800);
  await shot(page, "00-landing-desktop");
  await shot(page, "00b-landing-desktop-full", true);
  await page.goto(`${BASE}/check`);
  await page.waitForTimeout(1500);
  await shot(page, "01-check-desktop");
  await page.goto(`${BASE}/trends`);
  await page.waitForSelector("text=Scams by type", { timeout: 20_000 });
  await shot(page, "08-trends-desktop", true);
  await ctx.close();
}

// 2. Mobile English: example flows.
{
  const { ctx, page } = await newPage(browser, { mobile: true, lang: "en" });
  await page.goto(BASE);
  await page.waitForTimeout(1800);
  await shot(page, "02a-landing-mobile");
  await page.goto(`${BASE}/check`);
  await page.waitForTimeout(1500);
  await shot(page, "02-check-mobile");

  await page.getByRole("button", { name: "Fake KYC SMS with a bank link" }).click();
  await waitResult(page);
  await shot(page, "03-result-scam-mobile");
  await shot(page, "03b-result-scam-full", true);
  const resultUrl = page.url();

  await page.getByRole("link", { name: "Draft a complaint" }).click();
  await page.waitForSelector("text=Your complaint draft");
  await page.getByLabel(/Amount lost/).fill("50000");
  await shot(page, "06-complaint-mobile", true);

  await page.goto(resultUrl);
  await page.getByRole("button", { name: "Report this scam" }).click();
  await page.waitForTimeout(800);
  await shot(page, "07-report-dialog-mobile");
  await page.keyboard.press("Escape");

  await page.goto(`${BASE}/check`);
  await page.getByRole("button", { name: /QR code to/ }).click();
  await waitResult(page);
  await shot(page, "04-result-qr-mobile", true);

  await page.goto(`${BASE}/check`);
  await page.getByLabel("The message").fill("HDFC Bank: Rs 1,250.00 debited from A/c XX4521 on 14-10-26 at SWIGGY. Avl Bal Rs 18,430.55. If not you, call 18002586161.");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await waitResult(page);
  await shot(page, "05-result-no-signs-mobile");
  await ctx.close();
}

// 3. Mobile Hindi: one result.
{
  const { ctx, page } = await newPage(browser, { mobile: true, lang: "hi" });
  await page.goto(`${BASE}/check`);
  await page.waitForTimeout(1500);
  await shot(page, "09-check-hindi-mobile");
  await page.getByRole("button", { name: /डिजिटल अरेस्ट/ }).click();
  await waitResult(page);
  await shot(page, "10-result-hindi-voice-mobile", true);
  await ctx.close();
}

// 4. The warning card, rendered with the real renderer in a blank page.
{
  const bundle = await build({
    stdin: {
      contents: `import { renderWarningCard } from "@/share/renderCard"; window.__render = async (c, l) => { const b = await renderWarningCard(c, l, "https://project-91260b43-6705-4176-b71.web.app"); return new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); }); };`,
      resolveDir: resolve(root, "web/src"),
      loader: "ts",
    },
    bundle: true, write: false, format: "iife", platform: "browser",
    alias: { "@": resolve(root, "web/src") },
  });
  const page = await browser.newPage({ viewport: { width: 540, height: 675 } });
  await page.goto("about:blank");
  await page.addScriptTag({ content: bundle.outputFiles[0]!.text });
  const check = {
    id: "x", scam_type: "kyc_update", verdict: "scam", entityKeys: ["phone:+917000011111", "domain:bnb-kyc-update.web.app"],
    hits: [{ key: "phone:+917000011111", reportCount: 3, scamTypes: ["kyc_update"], linked: [], lastSeen: "2026-10-16T00:00:00Z" }],
  };
  const dataUrl: string = await page.evaluate(([c, l]) => (window as any).__render(c, l), [check, "en"] as const);
  await page.setContent(`<body style="margin:0"><img src="${dataUrl}" style="width:540px"></body>`);
  await page.locator("img").screenshot({ path: `${out}/11-share-card.png` });
}

await browser.close();
console.log("screenshots in", out);
