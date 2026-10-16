// Renders fake-payment.html to web/public/examples/fake-payment.png with Playwright.
// Usage: npx tsx scripts/examples/render-receipt.ts
import { chromium } from "playwright";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../../web/public/examples/fake-payment.png");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 640 }, deviceScaleFactor: 2 });
await page.goto(pathToFileURL(resolve(here, "fake-payment.html")).href);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log("wrote", out);
