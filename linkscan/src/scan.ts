import { chromium, type Browser, type BrowserContext, type Page, type Response } from "playwright";
import type { LinkScan } from "@scam-shield/shared";
import { isIP } from "node:net";
import { assertPublicUrl, BlockedUrlError, defaultLookup, resolvePublicUrl, type LookupFn } from "./guard";
import { startScanProxy } from "./proxy";
import type { ScanProxy } from "./proxy";

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
const DEFAULT_MAX_CONCURRENT_SCANS = 4;
const MAX_URL_OUT = 2048;
const MAX_REDIRECTS_OUT = 20;
const MOBILE_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36";
// Heavy, useless-for-triage resource types are never fetched.
const SKIPPED_RESOURCE_TYPES = new Set(["media", "font", "websocket", "eventsource"]);

// Network APIs that can open sockets outside the HTTP proxy are removed from every page/frame.
const INIT_SCRIPT = `(() => {
  for (const n of ["RTCPeerConnection", "webkitRTCPeerConnection", "mozRTCPeerConnection", "RTCDataChannel", "RTCSessionDescription", "RTCIceCandidate", "WebTransport"]) {
    try { Object.defineProperty(window, n, { value: undefined, writable: false, configurable: false }); } catch (e) {}
  }
})();`;

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
      // WebRTC could otherwise send UDP/STUN straight from the container, around the validating proxy.
      "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
      "--disable-quic",
      // One hostile page must not take the whole instance down: bound the V8 heap and renderer processes.
      // --jitless also removes the JIT, a large part of the renderer exploit surface (fine for triage).
      "--js-flags=--max-old-space-size=256 --jitless",
      "--renderer-process-limit=2",
      "--disable-gpu",
    ];
    // Opt-in only, for runtimes that cannot create Chromium's user-namespace sandbox (Cloud Run gen1/gVisor).
    // See SECURITY.md for the compensating controls. Never enabled by default.
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
const originOf = (u: string): string => { try { return new URL(u).origin; } catch { return ""; } };

class Timeout extends Error {}

function reasonFromError(e: unknown): Reason {
  if (e instanceof BlockedUrlError) return e.reason;
  if (e instanceof Timeout) return "timeout";
  const msg = e instanceof Error ? e.message : String(e);
  if (/ERR_NAME_NOT_RESOLVED|ERR_NAME_RESOLUTION_FAILED/.test(msg)) return "unresolvable";
  if (/Timeout \d+ms exceeded/i.test(msg)) return "timeout";
  return "scan_failed";
}

export const capUrl = (u: string): string => (u.length > MAX_URL_OUT ? u.slice(0, MAX_URL_OUT) : u);
export const capRedirects = (list: string[]): string[] => list.slice(0, MAX_REDIRECTS_OUT).map(capUrl);

/** Prefer the proxy denial that matches a main-frame navigation (document / redirect hop); else the first. */
export function pickDenial(denials: Array<{ reason: Reason; url: string }>, mainFrameUrls: Set<string>): Reason | undefined {
  const origins = new Set([...mainFrameUrls].map(originOf));
  const hit = denials.find((d) => origins.has(originOf(d.url)));
  return (hit ?? denials[0])?.reason;
}

// ---- concurrency / lifecycle accounting ----
let inFlight = 0;
let openProxies = 0;
let openContexts = 0;
let proxiesStarted = 0;
let contextsStarted = 0;

/** Internal counters, exposed for lifecycle tests. */
export function scanDebugCounters() {
  return { inFlight, openProxies, openContexts, proxiesStarted, contextsStarted };
}

function maxConcurrent(): number {
  const raw = process.env.MAX_CONCURRENT_SCANS;
  if (raw === undefined || raw === "") return DEFAULT_MAX_CONCURRENT_SCANS;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : DEFAULT_MAX_CONCURRENT_SCANS;
}

/** True if a scan slot is free (server.ts uses this to answer 503 on overflow). */
export function hasScanCapacity(): boolean {
  return inFlight < maxConcurrent();
}

export async function scanUrl(raw: string, opts: ScanOptions = {}): Promise<LinkScan> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const blocked = (blockedReason: Reason): LinkScan => ({ requestedUrl: raw, redirects: [], blockedReason });

  if (!hasScanCapacity()) return blocked("scan_failed");
  inFlight++;
  const deadline = Date.now() + timeoutMs;

  // Everything the scan opens is registered here so it can be closed from the deadline OR from run().
  const res: { context?: BrowserContext; proxy?: ScanProxy } = {};
  let aborted = false;
  let closing: Promise<void> = Promise.resolve();
  const closeAll = (): Promise<void> => {
    closing = closing.then(async () => {
      const c = res.context;
      const p = res.proxy;
      res.context = undefined;
      res.proxy = undefined;
      if (c) { await c.close().catch(() => undefined); openContexts--; }
      if (p) { await p.close().catch(() => undefined); openProxies--; }
    });
    return closing;
  };
  const bail = () => { if (aborted) throw new Timeout("deadline"); };

  // run() is the only owner of the in-flight slot: it is released after everything has been closed.
  const work = run()
    .catch((e): LinkScan => blocked(reasonFromError(e)))
    .finally(async () => {
      await closeAll();
      inFlight--;
    });

  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<LinkScan>((resolve) => {
    timer = setTimeout(() => {
      aborted = true;
      void closeAll(); // cancels in-flight page operations right away
      resolve(blocked("timeout"));
    }, timeoutMs);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }

  async function run(): Promise<LinkScan> {
    const allowPrivate = opts.allowPrivateForTests === true;
    const exemptOrigins = new Set((opts.testAllowedOrigins ?? []).map((o) => originOf(o)));
    const baseLookup = opts.lookup ?? defaultLookup;
    const cache = new Map<string, Promise<string[]>>();
    const lookup: LookupFn = (h) => {
      let p = cache.get(h);
      if (!p) { p = baseLookup(h); cache.set(h, p); }
      return p;
    };
    const isExempt = (u: string): boolean => allowPrivate || exemptOrigins.has(originOf(u));
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
        const host = new URL(u).hostname.replace(/^\[|\]$/g, "");
        return isIP(host) ? [host] : lookup(host);
      }
      return (await resolvePublicUrl(u, lookup)).addresses;
    };

    // 1. validate the requested URL before anything is opened
    await check(raw);
    bail();
    const px = await startScanProxy(authorize, MAX_TOTAL_BYTES);
    proxiesStarted++;
    openProxies++;
    res.proxy = px;
    bail();

    const browser = await getBrowser();
    bail();
    const ctx = await browser.newContext({
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
    contextsStarted++;
    openContexts++;
    res.context = ctx;
    bail();
    await ctx.addInitScript(INIT_SCRIPT);
    const page = await ctx.newPage();
    bail();

    let blockedNav: Reason | undefined;
    let requestCount = 0;
    const mainFrameUrls = new Set<string>();

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
    page.on("request", (r) => {
      if (r.isNavigationRequest() && r.frame() === page.mainFrame()) mainFrameUrls.add(r.url());
    });
    bail();

    let resp: Response | null;
    try {
      resp = await page.goto(raw, { waitUntil: "domcontentloaded", timeout: Math.max(1, deadline - Date.now()) });
    } catch (e) {
      bail();
      if (blockedNav) return blocked(blockedNav);
      if (px.overLimit()) return blocked("scan_failed");
      const d = pickDenial(px.deniedDetail, mainFrameUrls);
      if (d) return blocked(d);
      throw e;
    }
    bail();
    if (blockedNav) return blocked(blockedNav);
    if (px.denied.length && resp && resp.status() >= 300 && resp.status() < 400) {
      return blocked(pickDenial(px.deniedDetail, mainFrameUrls) ?? px.denied[0]);
    }

    const redirects: string[] = [];
    for (let r = resp?.request().redirectedFrom() ?? null; r; r = r.redirectedFrom()) redirects.unshift(r.url());

    // brief settle for JS-rendered content (not networkidle: trackers keep it open forever)
    const settle = Math.min(SETTLE_MS, Math.max(0, deadline - Date.now() - 2_000));
    if (settle > 0) await page.waitForTimeout(settle);
    bail();

    if (px.overLimit() || page.isClosed()) return blocked("scan_failed");

    // evaluated as a string: this package compiles without DOM typings
    const data = (await page.evaluate(
      "({ title: document.title || '', text: ((document.body && document.body.innerText) || '').slice(0, 100000) })",
    )) as { title: string; text: string };
    bail();
    const finalUrl = page.url();

    let screenshotDataUrl: string | undefined;
    try {
      const buf = await page.screenshot({ type: "jpeg", quality: 60, timeout: Math.max(1, deadline - Date.now()) });
      screenshotDataUrl = `data:image/jpeg;base64,${buf.toString("base64")}`;
    } catch { /* text result is still useful */ }
    bail();

    if (px.overLimit()) return blocked("scan_failed");

    return {
      requestedUrl: raw,
      finalUrl: capUrl(finalUrl),
      redirects: capRedirects(redirects),
      title: normalizeText(data.title).slice(0, MAX_TITLE),
      text: normalizeText(data.text).slice(0, MAX_TEXT),
      screenshotDataUrl,
      httpStatus: resp?.status(),
    };
  }
}
