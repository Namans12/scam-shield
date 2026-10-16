import { chromium, type Browser, type BrowserContext, type Page, type Response } from "playwright";
import type { LinkScan } from "@scam-shield/shared";
import { isIP } from "node:net";
import { assertPublicUrl, BlockedUrlError, defaultLookup, resolvePublicUrl, type LookupFn } from "./guard";
import { startScanProxy, type ScanProxy } from "./proxy";

type Reason = NonNullable<LinkScan["blockedReason"]>;

export interface ScanOptions {
  /** Hard overall budget for the whole scan (default 15 s). */
  timeoutMs?: number;
  /** Injectable DNS resolver (tests). Results are cached per scan. */
  lookup?: LookupFn;
  /** TEST ONLY: skip the private-address guard (still http/https only). Never set by server.ts. */
  allowPrivateForTests?: boolean;
  /** TEST ONLY: exact origins exempt from the private-address guard (still http/https only). Never set by server.ts. */
  testAllowedOrigins?: string[];
}

const DEFAULT_TIMEOUT_MS = 15_000;
const SETTLE_MS = 2_000;
const MAX_TEXT = 8_000;
const MAX_TITLE = 300;
const MAX_REQUESTS_PER_SCAN = 150;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024; // total bytes through the proxy (both directions) per scan
const MAX_CONCURRENT_SCANS = 6;
const MOBILE_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36";
// Heavy, useless-for-triage resource types are never fetched.
const SKIPPED_RESOURCE_TYPES = new Set(["media", "font", "websocket", "eventsource"]);

// ---- shared browser (one Chromium process; a fresh isolated context per scan) ----
let browserPromise: Promise<Browser> | null = null;

function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    const args = [
      "--disable-dev-shm-usage",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-sync",
      "--no-first-run",
      "--mute-audio",
      "--deny-permission-prompts",
    ];
    // Cloud Run (gVisor) cannot create the Chromium user-namespace sandbox; the container is the sandbox there.
    if (process.env.LINKSCAN_NO_SANDBOX === "1") args.push("--no-sandbox");
    browserPromise = chromium
      // Chromium needs a (dummy) launch-level proxy for per-context proxies to be honoured; every
      // context overrides it with its own validating proxy, so this address is never used.
      .launch({ headless: true, args, proxy: { server: "http://per-context" } })
      .then((b) => {
        b.on("disconnected", () => { browserPromise = null; });
        return b;
      })
      .catch((e) => { browserPromise = null; throw e; });
  }
  return browserPromise;
}

export async function closeBrowser(): Promise<void> {
  const p = browserPromise;
  browserPromise = null;
  if (p) await p.then((b) => b.close()).catch(() => undefined);
}

// ---- helpers ----
const normalizeText = (s: string) => s.replace(/\s+/g, " ").trim();

class Timeout extends Error {}

function withDeadline<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const t = new Promise<never>((_, rej) => { timer = setTimeout(() => rej(new Timeout("deadline")), ms); });
  p.catch(() => undefined); // never leave the loser unhandled
  return Promise.race([p, t]).finally(() => clearTimeout(timer));
}

function reasonFromError(e: unknown): Reason {
  if (e instanceof BlockedUrlError) return e.reason;
  if (e instanceof Timeout) return "timeout";
  const msg = e instanceof Error ? e.message : String(e);
  if (/ERR_NAME_NOT_RESOLVED|ERR_NAME_RESOLUTION_FAILED/.test(msg)) return "unresolvable";
  if (/Timeout \d+ms exceeded/i.test(msg)) return "timeout";
  return "scan_failed";
}

let inFlight = 0;

export async function scanUrl(raw: string, opts: ScanOptions = {}): Promise<LinkScan> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const blocked = (blockedReason: Reason): LinkScan => ({ requestedUrl: raw, redirects: [], blockedReason });

  if (inFlight >= MAX_CONCURRENT_SCANS) return blocked("scan_failed");
  inFlight++;
  const deadline = Date.now() + timeoutMs;
  let context = undefined as BrowserContext | undefined;
  let proxy = undefined as ScanProxy | undefined;
  try {
    return await withDeadline(run(), timeoutMs);
  } catch (e) {
    return blocked(reasonFromError(e));
  } finally {
    inFlight--;
    await context?.close().catch(() => undefined);
    await proxy?.close().catch(() => undefined);
  }

  async function run(): Promise<LinkScan> {
    const allowPrivate = opts.allowPrivateForTests === true;
    const exemptOrigins = new Set((opts.testAllowedOrigins ?? []).map((o) => { try { return new URL(o).origin; } catch { return ""; } }));
    const baseLookup = opts.lookup ?? defaultLookup;
    const cache = new Map<string, Promise<string[]>>();
    const lookup: LookupFn = (h) => {
      let p = cache.get(h);
      if (!p) { p = baseLookup(h); cache.set(h, p); }
      return p;
    };
    const isExempt = (u: string): boolean => {
      if (allowPrivate) return true;
      try { return exemptOrigins.has(new URL(u).origin); } catch { return false; }
    };
    /** Throws BlockedUrlError unless the URL is http(s) to a public destination. */
    const check = async (u: string): Promise<void> => {
      if (isExempt(u)) {
        let proto = "";
        try { proto = new URL(u).protocol; } catch { /* fallthrough */ }
        if (proto !== "http:" && proto !== "https:") throw new BlockedUrlError("bad_scheme");
        return;
      }
      await assertPublicUrl(u, lookup);
    };

    /** Proxy-side decision: validated addresses to connect to (DNS pinning). */
    const authorize = async (u: string): Promise<string[]> => {
      if (isExempt(u)) {
        await check(u); // scheme only
        const host = new URL(u).hostname.replace(/^[|]$/g, "");
        return isIP(host) ? [host] : lookup(host);
      }
      return (await resolvePublicUrl(u, lookup)).addresses;
    };

    // 1. validate the requested URL before a browser is even touched
    await check(raw);
    proxy = await startScanProxy(authorize, MAX_TOTAL_BYTES);
    const px = proxy;

    const browser = await getBrowser();
    context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 1,
      userAgent: MOBILE_UA,
      locale: "en-US",
      acceptDownloads: false,
      serviceWorkers: "block",
      // Every connection - including each redirect hop, which Playwright does not route - goes through
      // our validating proxy. "<-loopback>" removes Chromium's implicit proxy bypass for localhost,
      // 127/8, 169.254/16 and fe80::/10 so those cannot skip the proxy.
      proxy: { server: `http://127.0.0.1:${px.port}`, bypass: "<-loopback>" },
      permissions: [],
      ignoreHTTPSErrors: false,
      bypassCSP: false,
      javaScriptEnabled: true,
    });
    const ctx = context;
    const page = await ctx.newPage();

    let blockedNav: Reason | undefined;
    let requestCount = 0;

    // 2. re-validate every request the browser routes: document, subresources, frames. (Redirect hops and
    // DNS pinning are enforced by the proxy, since Playwright does not re-route redirects.)
    await ctx.route("**/*", async (route) => {
      const req = route.request();
      const u = req.url();
      const isMainNav = req.isNavigationRequest() && req.frame() === page.mainFrame();
      try {
        if (++requestCount > MAX_REQUESTS_PER_SCAN) throw new BlockedUrlError("scan_failed", "too many requests");
        if (SKIPPED_RESOURCE_TYPES.has(req.resourceType())) { await route.abort("blockedbyclient"); return; }
        await check(u);
        await route.continue();
      } catch (e) {
        if (isMainNav && !blockedNav) blockedNav = reasonFromError(e);
        await route.abort("blockedbyclient").catch(() => undefined);
      }
    });

    // no popups, dialogs or downloads
    ctx.on("page", (p: Page) => { if (p !== page) p.close().catch(() => undefined); });
    page.on("dialog", (d) => { d.dismiss().catch(() => undefined); });
    page.on("download", (d) => { d.cancel().catch(() => undefined); });

    let resp: Response | null;
    try {
      resp = await page.goto(raw, { waitUntil: "domcontentloaded", timeout: Math.max(1, deadline - Date.now()) });
    } catch (e) {
      if (blockedNav) return blocked(blockedNav);
      if (px.overLimit()) return blocked("scan_failed");
      if (px.denied.length) return blocked(px.denied[0]);
      throw e;
    }
    if (blockedNav) return blocked(blockedNav);
    if (px.denied.length && resp && resp.status() >= 300 && resp.status() < 400) return blocked(px.denied[0]);

    const redirects: string[] = [];
    for (let r = resp?.request().redirectedFrom() ?? null; r; r = r.redirectedFrom()) redirects.unshift(r.url());

    // brief settle for JS-rendered content (not networkidle: trackers keep it open forever)
    const settle = Math.min(SETTLE_MS, Math.max(0, deadline - Date.now() - 2_000));
    if (settle > 0) await page.waitForTimeout(settle);

    if (px.overLimit() || page.isClosed()) return blocked("scan_failed");

    // evaluated as a string: this package compiles without DOM typings
    const data = (await page.evaluate(
      "({ title: document.title || '', text: ((document.body && document.body.innerText) || '').slice(0, 100000) })",
    )) as { title: string; text: string };
    const finalUrl = page.url();

    let screenshotDataUrl: string | undefined;
    try {
      const buf = await page.screenshot({ type: "jpeg", quality: 60, timeout: Math.max(1, deadline - Date.now()) });
      screenshotDataUrl = `data:image/jpeg;base64,${buf.toString("base64")}`;
    } catch { /* text result is still useful */ }

    if (px.overLimit()) return blocked("scan_failed");

    return {
      requestedUrl: raw,
      finalUrl,
      redirects,
      title: normalizeText(data.title).slice(0, MAX_TITLE),
      text: normalizeText(data.text).slice(0, MAX_TEXT),
      screenshotDataUrl,
      httpStatus: resp?.status(),
    };
  }
}
