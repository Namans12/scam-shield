// Shared helpers for recording the live Scam Shield site with Playwright.
// Playwright does not draw the real mouse pointer in recordings, so a cursor is injected into the page and
// driven by real mouse events that we move along eased, slightly curved paths at a human pace.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const RAW = resolve(ROOT, "footage/raw");
export const BASE = process.env.SCAM_SHIELD_URL ?? "https://scam-shield-live.web.app";
mkdirSync(RAW, { recursive: true });

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const CURSOR_SCRIPT = () => {
  const SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="34" viewBox="0 0 30 34"><path d="M4 2 L4 26 L10 20.5 L14.2 30.5 L18.4 28.7 L14.2 18.8 L22.5 18.8 Z" fill="#0b1b32" stroke="#ffffff" stroke-width="2.2" stroke-linejoin="round"/></svg>';
  let cur;
  const ensure = () => {
    if (cur && cur.isConnected) return cur;
    if (!document.documentElement) return null;
    cur = document.createElement("div");
    cur.id = "__demo_cursor";
    cur.style.cssText =
      "position:fixed;left:0;top:0;width:30px;height:34px;z-index:2147483647;pointer-events:none;will-change:transform;filter:drop-shadow(0 3px 5px rgba(8,27,50,.35));";
    cur.innerHTML = SVG;
    document.documentElement.appendChild(cur);
    return cur;
  };
  const place = (x, y) => {
    const c = ensure();
    if (!c) return;
    c.style.transform = `translate(${x}px,${y}px)`;
    try {
      sessionStorage.setItem("__cx", `${x},${y}`);
    } catch {}
  };
  const ripple = (x, y) => {
    if (!document.documentElement) return;
    const r = document.createElement("div");
    r.style.cssText = `position:fixed;left:${x - 22}px;top:${y - 22}px;width:44px;height:44px;border-radius:50%;z-index:2147483646;pointer-events:none;border:3px solid rgba(23,100,232,.85);background:rgba(23,100,232,.18);transform:scale(.3);opacity:1;transition:transform .5s cubic-bezier(.2,.7,.2,1),opacity .5s ease-out;`;
    document.documentElement.appendChild(r);
    requestAnimationFrame(() => {
      r.style.transform = "scale(1.25)";
      r.style.opacity = "0";
    });
    setTimeout(() => r.remove(), 650);
  };
  addEventListener("mousemove", (e) => place(e.clientX, e.clientY), true);
  addEventListener("mousedown", (e) => ripple(e.clientX, e.clientY), true);
  const restore = () => {
    let p = null;
    try {
      p = sessionStorage.getItem("__cx");
    } catch {}
    if (p) place(...p.split(",").map(Number));
  };
  document.addEventListener("DOMContentLoaded", restore);
  addEventListener("load", restore);
};


// Frame recorder. Playwright's built-in recordVideo runs a few percent slow against the wall clock under load, which
// would put every mark in the manifest slightly off, so the clip is recorded from the same CDP screencast that
// recordVideo uses, but every frame keeps its true timestamp. Frames are resampled to a constant 30 fps and encoded
// with the ffmpeg that ships with Remotion (high quality JPEG frames in, H.264 out).
const FFMPEG = resolve(dirname(require.resolve("@remotion/compositor-darwin-arm64/package.json")), "ffmpeg");
async function startRecorder(ctx, page, size) {
  const cdp = await ctx.newCDPSession(page);
  const frames = [];
  cdp.on("Page.screencastFrame", (f) => {
    frames.push({ ts: f.metadata.timestamp, buf: Buffer.from(f.data, "base64") });
    cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 94, maxWidth: size.width, maxHeight: size.height, everyNthFrame: 1 });
  return {
    frames,
    async stop() {
      await cdp.send("Page.stopScreencast").catch(() => {});
    },
  };
}

async function encode(frames, startSec, endSec, out, fps = 30) {
  if (!frames.length) throw new Error("no frames captured");
  const ff = spawn(FFMPEG, ["-y", "-loglevel", "error", "-f", "image2pipe", "-c:v", "mjpeg", "-framerate", String(fps), "-i", "pipe:0", "-c:v", "libx264", "-preset", "slow", "-crf", "13", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out], { cwd: dirname(FFMPEG), stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise((res, rej) => ff.on("exit", (c) => (c === 0 ? res() : rej(new Error("ffmpeg exited " + c)))));
  const n = Math.ceil((endSec - startSec) * fps);
  let j = 0;
  for (let i = 0; i < n; i++) {
    const t = startSec + i / fps;
    while (j + 1 < frames.length && frames[j + 1].ts <= t) j++;
    if (!ff.stdin.write(frames[j].buf)) await new Promise((r) => ff.stdin.once("drain", r));
  }
  ff.stdin.end();
  await done;
}

export async function launch() {
  return chromium.launch({ args: ["--force-color-profile=srgb", "--hide-scrollbars"] });
}

/**
 * Opens a recorded page. Returns helpers; call clip.finish() to save raw/<name>.webm and raw/<name>.json.
 * opts: { mobile, lang, storageState, size }
 */
export async function newClip(browser, name, opts = {}) {
  const mobile = !!opts.mobile;
  const viewport = mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 };
  const dsf = mobile ? 2 : 1;
  const ctx = await browser.newContext({
    viewport,
    deviceScaleFactor: dsf,
    isMobile: mobile,
    hasTouch: mobile,
    colorScheme: "light",
    locale: "en-IN",
    ...(opts.storageState && { storageState: opts.storageState }),
  });
  await ctx.addInitScript((l) => {
    try {
      if (!localStorage.getItem("scamshield:lang")) localStorage.setItem("scamshield:lang", l);
    } catch {}
  }, opts.lang ?? "en");
  if (!mobile) await ctx.addInitScript(CURSOR_SCRIPT);
  const page = await ctx.newPage();
  const t0 = Date.now();
  const rec = await startRecorder(ctx, page, { width: viewport.width * dsf, height: viewport.height * dsf });
  const marks = {};
  let pos = { x: 720, y: 520 };
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push(String(e)));

  const clip = {
    page,
    ctx,
    marks,
    mark(label) {
      marks[label] = (Date.now() - t0) / 1000;
      console.log(`  [${name}] ${label} @ ${marks[label].toFixed(2)}s`);
    },
    now: () => (Date.now() - t0) / 1000,
    async goto(path) {
      await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
      await sleep(600);
      if (!mobile) await page.mouse.move(pos.x, pos.y);
    },
    async hold(ms) {
      await sleep(ms);
    },
    /** Move the pointer along an eased, gently curved path. */
    async moveTo(x, y, ms) {
      if (mobile) return;
      const dist = Math.hypot(x - pos.x, y - pos.y);
      const dur = ms ?? Math.min(1500, 420 + dist * 1.1);
      const steps = Math.max(12, Math.round(dur / 16));
      const nx = -(y - pos.y) / (dist || 1);
      const ny = (x - pos.x) / (dist || 1);
      const bend = Math.min(60, dist * 0.08) * (x > pos.x ? 1 : -1);
      const start = { ...pos };
      const t1 = Date.now();
      for (let i = 1; i <= steps; i++) {
        const k = easeInOut(i / steps);
        const arc = Math.sin(Math.PI * k) * bend;
        await page.mouse.move(start.x + (x - start.x) * k + nx * arc, start.y + (y - start.y) * k + ny * arc);
        const target = t1 + (dur * i) / steps;
        const wait = target - Date.now();
        if (wait > 0) await sleep(wait);
      }
      pos = { x, y };
    },
    async moveToEl(locator, { dx = 0, dy = 0, ms } = {}) {
      await locator.scrollIntoViewIfNeeded().catch(() => {});
      const box = await locator.boundingBox();
      if (!box) throw new Error("no box for locator");
      await clip.moveTo(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, ms);
      return box;
    },
    async click(locator, opts = {}) {
      if (mobile) {
        await locator.click();
        return;
      }
      await clip.moveToEl(locator, opts);
      await sleep(180);
      await page.mouse.down();
      await sleep(70);
      await page.mouse.up();
      await sleep(250);
    },
    /** Smooth scroll by dy pixels over ms milliseconds (wheel events, eased). */
    async scrollBy(dy, ms = 1400) {
      const steps = Math.max(8, Math.round(ms / 16));
      let last = 0;
      const t1 = Date.now();
      for (let i = 1; i <= steps; i++) {
        const target = Math.round(dy * easeInOut(i / steps));
        const d = target - last;
        last = target;
        if (d !== 0) await page.mouse.wheel(0, d);
        const wait = t1 + (ms * i) / steps - Date.now();
        if (wait > 0) await sleep(wait);
      }
    },
    async scrollToEl(locator, { offset = 120, ms = 1400 } = {}) {
      const top = await locator.evaluate((el) => el.getBoundingClientRect().top);
      await clip.scrollBy(top - offset, ms);
    },
    async type(locator, text, delay = 55) {
      await clip.click(locator);
      await page.keyboard.type(text, { delay });
    },
    /** Waits for the result page; throws (so the clip is recorded again) if the check shows an error. */
    async waitForResult(timeout = 75_000) {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        if (/\/result\//.test(page.url())) {
          await sleep(900);
          return;
        }
        const err = await page.locator('[role="alert"]').first().textContent({ timeout: 200 }).catch(() => null);
        if (err) throw new Error("check failed on screen: " + err.trim().slice(0, 120));
        await sleep(250);
      }
      throw new Error("timed out waiting for the result");
    },
    async finish({ keepState } = {}) {
      if (keepState) await ctx.storageState({ path: resolve(RAW, `${name}.state.json`), indexedDB: true });
      await sleep(300);
      const end = Date.now();
      await rec.stop();
      const url = page.url();
      await ctx.close();
      const dest = resolve(RAW, `${name}.mp4`);
      await encode(rec.frames, t0 / 1000, end / 1000, dest);
      writeFileSync(resolve(RAW, `${name}.json`), JSON.stringify({ name, mobile, marks, regions: clip.regions ?? {}, snaps: clip.snaps ?? [], duration: (end - t0) / 1000, url, consoleErrors, frames: rec.frames.length }, null, 2));
      console.log(`saved ${dest} (${((end - t0) / 1000).toFixed(1)}s, ${rec.frames.length} frames captured)`);
    },
  };
  return clip;
}

export function loadMeta(name) {
  const f = resolve(RAW, `${name}.json`);
  return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null;
}
