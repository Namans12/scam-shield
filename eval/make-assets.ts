// Generates the two genuine image cases: a correct UPI receipt and a QR that really asks to PAY a shop.
// Usage: npx tsx eval/make-assets.ts
import QRCode from "qrcode";
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dir = resolve(here, "assets");
mkdirSync(dir, { recursive: true });

await QRCode.toFile(resolve(dir, "legit-pay-qr.png"), "upi://pay?pa=sharmastore@okicici&pn=Sharma%20General%20Store&am=250&cu=INR&tn=Groceries", { width: 600, margin: 4 });

const html = `<!doctype html><meta charset=utf-8><body style="margin:0;width:390px;font-family:-apple-system,Arial,sans-serif;background:#f3f4f6">
<div style="background:#0f9d58;color:#fff;text-align:center;padding:36px 16px 28px"><div style="width:64px;height:64px;border-radius:50%;background:#fff;color:#0f9d58;font-size:40px;line-height:64px;margin:0 auto 12px">✓</div><div style="font-size:40px;font-weight:700">₹3,600</div><div style="font-size:18px">Payment Successful</div></div>
<div style="background:#fff;margin:14px;border-radius:14px;padding:6px 16px;font-size:14px">
<div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #eee"><span style="color:#666">To</span><b style="text-align:right">Ananya Rao<br><small>ananya.rao@okhdfcbank</small></b></div>
<div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #eee"><span style="color:#666">From</span><b style="text-align:right">Kunal Verma<br><small>kunal.verma@oksbi</small></b></div>
<div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #eee"><span style="color:#666">UTR</span><b>428901736254</b></div>
<div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #eee"><span style="color:#666">Date</span><b>12 Oct 2026, 7:18 PM</b></div>
<div style="display:flex;justify-content:space-between;padding:12px 0"><span style="color:#666">Status</span><b style="color:#0f9d58">Completed</b></div></div></body>`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 640 }, deviceScaleFactor: 2 });
await page.setContent(html);
await page.screenshot({ path: resolve(dir, "legit-receipt.png"), fullPage: true });
await browser.close();
console.log("wrote assets in", dir);
