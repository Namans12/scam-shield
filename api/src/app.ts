import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import type { Context, MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { INDIAN_STATES, maskIdentifier } from "@scam-shield/shared";
import type {
  CheckRequest, CheckResult, EntityHit, EntityKey, GeminiVerdict, HardSignal, Lang, LinkScan, QrInfo, RedFlag, ScamType,
} from "@scam-shield/shared";
import { applyHardSignals } from "./combine";
import { extractEntities, luhnValid, toAsciiDigits, toEntityKeys } from "./extract";
import type { ExtractedEntities } from "./extract";
import type { VerdictModel } from "./gemini";
import type { LinkScanner } from "./linkscanClient";
import { createRateLimiter } from "./rateLimit";
import { decodeQr, parseUpiUri } from "./qr";
import { redact } from "./redact";
import type { Store, StoredCheck } from "./store";

export type { LinkScanner };

export interface AuthUser { uid: string; provider: string }
export interface AppDeps {
  store: Store; model: VerdictModel; scanner: LinkScanner;
  verifyToken(idToken: string): Promise<AuthUser>;
  /**
   * `mimeType` must be the stored object's own contentType (never client-supplied). `size` is the object's real size.
   * With `metadataOnly` implementations must NOT download the bytes (return an empty buffer); the app calls it that way
   * first, validates type/size, spends the user's quota, and only then asks for the bytes. Throw `UploadNotFoundError` when
   * the object does not exist; any other error is treated as an internal failure.
   */
  readUpload(path: string, opts?: { metadataOnly?: boolean }): Promise<{ bytes: Buffer; gcsUri: string; mimeType: string; size: number }>;
  saveScreenshot(uid: string, checkId: string, jpeg: Buffer): Promise<string>;
  copyEvidence(storagePath: string, reportId: string): Promise<void>;
  now(): Date;
  limits: { perUidPerDay: number; globalPerDay: number; perIpPerMinute: number; /** default 60 */ perIpReportPerMinute?: number };
  /** Number of trusted proxies appended to X-Forwarded-For (default 2: Firebase Hosting + Cloud Run front end). */
  trustedProxyHops?: number;
  /** Hard limit for one /api/check (default 45 000 ms). */
  checkTimeoutMs?: number;
}

export const MAX_TEXT_CHARS = 5000;
export const MAX_URL_CHARS = 2048;
export const MAX_BODY_BYTES = 32 * 1024;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 15 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = Math.max(MAX_IMAGE_BYTES, MAX_AUDIO_BYTES);
export const MAX_KEYS_PER_CHECK = 20;
export const MAX_KEY_CHARS = 200;
export const CHECK_TIMEOUT_MS = 45_000;
const STORED_PAGE_TEXT_CHARS = 3000;

const IMAGE_MIMES = new Set(["image/png", "image/jpeg", "image/webp"]);
const AUDIO_MIMES = new Set(["audio/mpeg", "audio/mp4", "audio/aac", "audio/ogg", "audio/wav", "audio/webm"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CITY_RE = /^[\p{L}\p{M} .'-]+$/u;

export const DEFAULT_TRUSTED_PROXY_HOPS = 2;
export const DEFAULT_REPORT_PER_IP_PER_MINUTE = 60;

/** Thrown by `readUpload` when the storage object does not exist. */
export class UploadNotFoundError extends Error {
  constructor() { super("upload_not_found"); this.name = "UploadNotFoundError"; }
}

const TEXTS = {
  en: {
    reported: "This number/ID/link has been reported to Scam Shield before.",
    qr: "This QR asks you to PAY money, but the message says you will receive it.",
    step: "Do not pay or share any OTP/PIN. Call 1930 if you've lost money.",
    flagReported: "Reported to Scam Shield before",
    whyReported: "Other users have reported this identifier as part of a scam.",
    flagQr: "The QR code takes money out of your account",
    whyQr: "Scanning a pay QR and entering your PIN sends money out. You never need a PIN or QR to receive money.",
    evReported: (masked: string, n: number) => `${masked} reported ${n} ${n === 1 ? "time" : "times"}`,
    evQr: (pa: string, am?: string) => `Payee ${pa}${am ? `, amount ${am}` : ""}`,
  },
  hi: {
    reported: "इस नंबर/आईडी/लिंक की Scam Shield पर पहले भी शिकायत की जा चुकी है।",
    qr: "यह QR आपसे पैसे भेजने (PAY) को कहता है, जबकि संदेश कहता है कि आपको पैसे मिलेंगे।",
    step: "पैसे न भेजें और OTP/PIN किसी को न बताएं। अगर पैसे चले गए हैं तो 1930 पर कॉल करें।",
    flagReported: "Scam Shield पर पहले भी शिकायत हो चुकी है",
    whyReported: "दूसरे उपयोगकर्ताओं ने इस पहचान को धोखाधड़ी से जुड़ा बताया है।",
    flagQr: "यह QR आपके खाते से पैसे निकालता है",
    whyQr: "पे QR स्कैन करके PIN डालने से पैसे बाहर जाते हैं। पैसे पाने के लिए PIN या QR की ज़रूरत नहीं होती।",
    evReported: (masked: string, n: number) => `${masked} की ${n} बार शिकायत हुई`,
    evQr: (pa: string, am?: string) => `प्राप्तकर्ता ${pa}${am ? `, राशि ${am}` : ""}`,
  },
} as const;

class ApiError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); }
}

// Short, content-free server-side log line. Never pass user content or error messages here.
const logCode = (code: string) => console.error(`scam-shield: ${code}`);

function reply(c: Context, status: number, body: unknown): Response {
  return c.json(body as object, status as ContentfulStatusCode);
}
const fail = (c: Context, status: number, error: string) => reply(c, status, { error });

function istDay(d: Date): string {
  return new Date(d.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
}

/**
 * Client IP for the best-effort per-IP limiter. X-Forwarded-For is client-controlled at its left end; the
 * trusted proxies append to the right, so take the `hops`-th entry from the right (fewer entries: the first).
 */
function clientIp(c: Context, hops: number): string {
  const parts = (c.req.header("x-forwarded-for") ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const ip = parts.length >= hops ? parts[parts.length - hops] : parts[0];
  return (ip || "unknown").slice(0, 64);
}

// ---------------------------------------------------------------------------
// Request validation
// ---------------------------------------------------------------------------

/** "example.com/x" -> "https://example.com/x"; null for anything that is not a plain http(s) URL. */
function normalizeUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t || t.length > MAX_URL_CHARS || /\s/.test(t)) return null;
  let candidate: string;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t)) candidate = t;
  else if (/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(t)) return null; // javascript:, mailto:, data: ...
  else candidate = `https://${t}`;
  try {
    const u = new URL(candidate);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".") && !u.hostname.includes(":")) return null;
    return candidate;
  } catch {
    return null;
  }
}

interface ParsedCheck { text?: string; url?: string; storagePath?: string; mimeType?: string; lang: Lang }

function parseCheckRequest(body: unknown): ParsedCheck {
  if (typeof body !== "object" || body === null || Array.isArray(body)) throw new ApiError(400, "bad_request");
  const b = body as Partial<Record<keyof CheckRequest, unknown>>;
  for (const k of ["text", "url", "storagePath", "mimeType"] as const) {
    if (b[k] !== undefined && b[k] !== null && typeof b[k] !== "string") throw new ApiError(400, "bad_request");
  }
  const lang: Lang = b.lang === "hi" ? "hi" : "en";
  const rawText = typeof b.text === "string" ? b.text : "";
  if (rawText.length > MAX_TEXT_CHARS) throw new ApiError(400, "text_too_long");
  const text = rawText.trim() || undefined;
  const rawUrl = typeof b.url === "string" ? b.url.trim() : "";
  let url: string | undefined;
  if (rawUrl) {
    const n = normalizeUrl(rawUrl);
    if (!n) throw new ApiError(400, "bad_url");
    url = n;
  }
  const storagePath = typeof b.storagePath === "string" && b.storagePath ? b.storagePath : undefined;
  if (!text && !url && !storagePath) throw new ApiError(400, "empty_input");
  return { text, url, storagePath, mimeType: typeof b.mimeType === "string" ? b.mimeType : undefined, lang };
}

function ownsUpload(path: string, uid: string): boolean {
  if (path.length > 512 || path.split("/").some((s) => s === ".." || s === ".")) return false;
  return path.startsWith(`uploads/${uid}/`) && path.length > `uploads/${uid}/`.length;
}

function baseMime(m: string | undefined): string {
  return (m ?? "").split(";")[0].trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

// Verhoeff checksum: every real Aadhaar number passes it, so a 12-digit "account number" the model
// returned that passes is treated as an Aadhaar and never becomes an entity key.
const VD = [[0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],[3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],[6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],[9,8,7,6,5,4,3,2,1,0]];
const VP = [[0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],[8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],[2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8]];
export function verhoeffValid(digits: string): boolean {
  let c = 0;
  const rev = [...digits].reverse();
  for (let i = 0; i < rev.length; i++) c = VD[c][VP[i % 8][Number(rev[i])]];
  return c === 0;
}
function looksLikeAadhaar(d: string): boolean {
  return d.length === 12 && /^[2-9]/.test(d) && verhoeffValid(d);
}

/** Deduplicates, drops over-long keys, and caps at MAX_KEYS_PER_CHECK, keeping first-seen order. */
function mergeKeys(...lists: EntityKey[][]): EntityKey[] {
  const out = new Set<EntityKey>();
  for (const list of lists) {
    for (const k of list) {
      if (out.size >= MAX_KEYS_PER_CHECK) return [...out];
      if (k.length <= MAX_KEY_CHARS) out.add(k);
    }
  }
  return [...out];
}

/** Identifiers Gemini read from images/audio, normalised through the same extractor as typed text. */
function modelEntityKeys(e: GeminiVerdict["entities"]): EntityKey[] {
  const take = (xs: unknown): string[] => (Array.isArray(xs) ? xs.filter((x): x is string => typeof x === "string").slice(0, 10).map((x) => x.slice(0, 300)) : []);
  const ex = extractEntities([...take(e.phones), ...take(e.upi_ids), ...take(e.urls)].join("\n"));
  const accts: EntityKey[] = [];
  for (const a of take(e.bank_accounts)) {
    const d = toAsciiDigits(a).replace(/[\s-]/g, "");
    if (/^\d{9,18}$/.test(d) && !looksLikeAadhaar(d) && !(d.length >= 13 && luhnValid(d))) accts.push(`acct:${d}`);
  }
  return [...toEntityKeys(ex), ...accts];
}

// ---------------------------------------------------------------------------
// Verdict post-processing
// ---------------------------------------------------------------------------

/**
 * When a hard signal raised a model "no_signs" verdict, the model's text ("no signs found") would contradict the verdict,
 * so replace the summary with a localized sentence per signal and add a matching red flag and next step.
 */
function reconcile(model: GeminiVerdict, out: GeminiVerdict, lang: Lang, hardSignals: HardSignal[], hits: EntityHit[], qr?: QrInfo): GeminiVerdict {
  if (!(model.verdict === "no_signs" && out.verdict !== "no_signs")) return out;
  const t = TEXTS[lang];
  const qrSignal = hardSignals.includes("qr_pay_disguised_as_receive");
  const reportedSignal = hardSignals.includes("reported_entity") || hardSignals.includes("multi_reported_entity");
  const sentences: string[] = [];
  const flags: RedFlag[] = [];
  if (qrSignal && qr?.upi) {
    sentences.push(t.qr);
    flags.push({ flag: t.flagQr, evidence: t.evQr(qr.upi.pa, qr.upi.am), why_it_matters: t.whyQr });
  }
  const top = hits.reduce<EntityHit | undefined>((m, h) => (!m || h.reportCount > m.reportCount ? h : m), undefined);
  if (reportedSignal && top) {
    sentences.push(t.reported);
    flags.push({ flag: t.flagReported, evidence: t.evReported(maskIdentifier(top.key), top.reportCount), why_it_matters: t.whyReported });
  }
  if (sentences.length === 0) return out;
  return {
    ...out,
    scam_type: out.scam_type === "none" ? (qrSignal ? "qr_receive_scam" : "other") : out.scam_type,
    summary: sentences.join(" "),
    red_flags: [...flags, ...out.red_flags],
    next_steps: [t.step, ...out.next_steps],
  };
}

function storedCopy(result: CheckResult, uid: string, keys: EntityKey[], text: string | undefined, storagePath: string | undefined, screenshotPath: string | undefined): StoredCheck {
  const r = (s: string) => redact(s, keys);
  const byType = (type: string) => keys.filter((k) => k.startsWith(`${type}:`)).map((k) => k.slice(type.length + 1));
  const { linkScan, ...rest } = result;
  const stored: StoredCheck = {
    ...rest,
    summary: r(result.summary),
    red_flags: result.red_flags.map((f) => ({ flag: r(f.flag), evidence: r(f.evidence), why_it_matters: r(f.why_it_matters) })),
    next_steps: result.next_steps.map(r),
    // Never persist the model's raw entities (they can hold the victim's own Aadhaar/card numbers): only the vetted keys.
    entities: {
      phones: byType("phone"), upi_ids: byType("upi"), urls: byType("domain"), bank_accounts: byType("acct"),
      brands_impersonated: result.entities.brands_impersonated.slice(0, 10).map(r),
    },
    uid,
  };
  if (result.transcript !== undefined) stored.transcript = r(result.transcript);
  if (text) stored.redactedText = r(text);
  if (storagePath) stored.storagePath = storagePath;
  if (screenshotPath) stored.screenshotPath = screenshotPath;
  if (linkScan) {
    const { screenshotDataUrl: _drop, ...ls } = linkScan;
    stored.linkScan = ls.text ? { ...ls, text: ls.text.slice(0, STORED_PAGE_TEXT_CHARS) } : ls;
  }
  return stored;
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();
  // The per-IP limiters are BEST-EFFORT only (in-memory per instance, keyed by a header the client partly controls,
  // and they fail open when full). The real cost guards are the per-uid and global daily counters in the store.
  // Follow-up: Firebase App Check to tie requests to a genuine app instance.
  const hops = Math.max(1, Math.floor(deps.trustedProxyHops ?? DEFAULT_TRUSTED_PROXY_HOPS));
  const checkLimiter = createRateLimiter({ max: deps.limits.perIpPerMinute, windowMs: 60_000 });
  const reportLimiter = createRateLimiter({ max: deps.limits.perIpReportPerMinute ?? DEFAULT_REPORT_PER_IP_PER_MINUTE, windowMs: 60_000 });
  const timeoutMs = deps.checkTimeoutMs ?? CHECK_TIMEOUT_MS;

  app.use("/api/*", async (c, next) => {
    await next();
    c.header("Cache-Control", "no-store");
  });

  const ipLimit = (limiter: ReturnType<typeof createRateLimiter>): MiddlewareHandler => async (c, next) => {
    if (limiter.isLimited(clientIp(c, hops))) {
      c.header("Retry-After", "60");
      return fail(c, 429, "rate_limited");
    }
    await next();
  };
  const sizeLimit = bodyLimit({ maxSize: MAX_BODY_BYTES, onError: (c) => fail(c, 400, "text_too_long") });
  app.use("/api/check", ipLimit(checkLimiter), sizeLimit);
  app.use("/api/report", ipLimit(reportLimiter), sizeLimit);

  async function authenticate(c: Context): Promise<AuthUser | null> {
    const m = /^Bearer\s+(\S+)$/i.exec(c.req.header("authorization") ?? "");
    if (!m) return null;
    try {
      const u = await deps.verifyToken(m[1]);
      return u?.uid ? u : null;
    } catch {
      return null;
    }
  }

  async function readJson(c: Context): Promise<unknown> {
    try { return await c.req.json(); } catch { throw new ApiError(400, "bad_request"); }
  }

  async function safeHits(keys: EntityKey[]): Promise<EntityHit[]> {
    if (keys.length === 0) return [];
    try { return await deps.store.getHits(keys); } catch { logCode("hits_failed"); return []; }
  }

  async function scanLink(url: string | undefined, signal: AbortSignal): Promise<LinkScan | undefined> {
    if (!url) return undefined;
    try {
      return await deps.scanner.scan(url, signal);
    } catch {
      logCode("scan_failed");
      return { requestedUrl: url, redirects: [], blockedReason: "scan_failed" };
    }
  }

  app.get("/api/health", (c) => c.json({ ok: true }));

  app.post("/api/check", async (c) => {
    const user = await authenticate(c);
    if (!user) return fail(c, 401, "unauthorized");
    try {
      const req = parseCheckRequest(await readJson(c));
      if (req.storagePath && !ownsUpload(req.storagePath, user.uid)) throw new ApiError(403, "not_your_upload");

      const state: CheckState = { aborted: false, ctrl: new AbortController() };
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => { state.aborted = true; state.ctrl.abort(); reject(new ApiError(502, "analysis_failed")); }, timeoutMs);
      });
      const work = runCheck(user, req, state);
      work.catch(() => {}); // a late failure after the timeout must not become an unhandled rejection
      try {
        return reply(c, 200, await Promise.race([work, timeout]));
      } finally {
        clearTimeout(timer);
      }
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status >= 500) logCode(e.code);
        return fail(c, e.status, e.code);
      }
      logCode("analysis_failed");
      return fail(c, 502, "analysis_failed");
    }
  });

  type Upload = Awaited<ReturnType<AppDeps["readUpload"]>>;
  interface CheckState { aborted: boolean; ctrl: AbortController }

  async function loadUpload(path: string, metadataOnly: boolean): Promise<Upload> {
    try {
      return await deps.readUpload(path, metadataOnly ? { metadataOnly: true } : undefined);
    } catch (e) {
      if (e instanceof UploadNotFoundError) throw new ApiError(400, "upload_not_found");
      throw new ApiError(502, "internal_error");
    }
  }

  /** Type and size from the stored object's own metadata only (never the client's claim). */
  function classifyUpload(up: Upload): { mime: string; isImage: boolean } {
    const mime = baseMime(up.mimeType);
    const isImage = IMAGE_MIMES.has(mime);
    if (!isImage && !AUDIO_MIMES.has(mime)) throw new ApiError(400, "unsupported_type");
    if (!(up.size <= (isImage ? MAX_IMAGE_BYTES : MAX_AUDIO_BYTES)) || up.bytes.length > (isImage ? MAX_IMAGE_BYTES : MAX_AUDIO_BYTES)) {
      throw new ApiError(400, "file_too_large");
    }
    return { mime, isImage };
  }

  async function runCheck(user: AuthUser, req: ParsedCheck, state: CheckState): Promise<CheckResult> {
    const started = Date.now();
    const { text, url, lang } = req;

    // 1. Cheap rejections first: upload metadata (no download) before any quota is spent.
    if (req.storagePath) classifyUpload(await loadUpload(req.storagePath, true));

    // 2. Usage counters fail OPEN (a Firestore hiccup must not take the check down). The global counter only
    //    advances while the uid is within its own limit, so one user cannot burn the shared budget.
    try {
      const { uidCount, globalCount } = await deps.store.bumpUsage(user.uid, istDay(deps.now()), deps.limits.perUidPerDay);
      if (uidCount > deps.limits.perUidPerDay || globalCount > deps.limits.globalPerDay) throw new ApiError(429, "daily_limit");
    } catch (e) {
      if (e instanceof ApiError) throw e;
      logCode("usage_failed");
    }

    // 3. Now fetch the bytes (re-validating: the object could have changed since the metadata read).
    let media: { gcsUri: string; mimeType: string } | undefined;
    let qr: QrInfo | undefined;
    let mime = "";
    if (req.storagePath) {
      const up = await loadUpload(req.storagePath, false);
      const cls = classifyUpload(up);
      mime = cls.mime;
      media = { gcsUri: up.gcsUri, mimeType: mime };
      if (cls.isImage) {
        const raw = await decodeQr(up.bytes);
        if (raw) {
          const upi = parseUpiUri(raw);
          qr = upi ? { raw, upi } : { raw };
        }
      }
    }
    const inputKind: CheckResult["inputKind"] = mime.startsWith("audio/") ? "audio" : mime.startsWith("image/") ? "image" : url ? "link" : "text";

    // 2. Entities from everything the user gave us (typed text, link, QR payload and its payee).
    const entities: ExtractedEntities = extractEntities([text, url, qr?.raw, qr?.upi?.pa].filter(Boolean).join("\n"));
    let keys = mergeKeys(toEntityKeys(entities));

    // 3. Scam-list lookup and link scan in parallel.
    const scanTarget = url
      ?? [...(text ? extractEntities(text).urls : []), ...(qr?.raw && /^https?:\/\//i.test(qr.raw) ? [qr.raw] : [])].map(normalizeUrl).find((u): u is string => !!u);
    const [hits0, linkScan] = await Promise.all([safeHits(keys), scanLink(scanTarget, state.ctrl.signal)]);
    let hits = hits0;

    // 4. Model.
    const modelVerdict = await deps.model.analyze({ text, media, lang, entities, hits, qr, linkScan });

    // 5. Identifiers the model read from images/audio: add to the keys and look them up too.
    const known = new Set(keys);
    const merged = mergeKeys(keys, modelEntityKeys(modelVerdict.entities));
    const added = merged.filter((k) => !known.has(k));
    if (added.length) {
      const more = await safeHits(added);
      const seen = new Set(hits.map((h) => h.key));
      hits = [...hits, ...more.filter((h) => !seen.has(h.key))];
    }
    keys = merged;

    // 6. Deterministic overrides.
    const { verdict: combined, hardSignals } = applyHardSignals(modelVerdict, {
      hits, qr, text: [text, modelVerdict.transcript].filter(Boolean).join("\n") || undefined,
    });
    const verdict = reconcile(modelVerdict, combined, lang, hardSignals, hits, qr);

    const id = randomUUID();
    const result: CheckResult = {
      ...verdict, id, createdAt: deps.now().toISOString(), inputKind,
      entityKeys: keys, hits, hardSignals, latencyMs: 0,
    };
    if (qr) result.qr = qr;
    if (linkScan) result.linkScan = linkScan;

    if (state.aborted) throw new ApiError(502, "analysis_failed");

    // 7. Persist (redacted). The screenshot goes to Storage; only its path is stored.
    let screenshotPath: string | undefined;
    const shot = linkScan?.screenshotDataUrl ? /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(linkScan.screenshotDataUrl)?.[1] : undefined;
    if (shot) {
      try {
        const jpeg = Buffer.from(shot, "base64");
        if (jpeg.length) screenshotPath = await deps.saveScreenshot(user.uid, id, jpeg);
      } catch { logCode("screenshot_failed"); }
    }
    result.latencyMs = Date.now() - started;
    if (state.aborted) throw new ApiError(502, "analysis_failed");
    try {
      await deps.store.saveCheck(storedCopy(result, user.uid, keys, text, req.storagePath, screenshotPath));
    } catch { logCode("save_failed"); }
    return result;
  }

  app.post("/api/report", async (c) => {
    const user = await authenticate(c);
    if (!user) return fail(c, 401, "unauthorized");
    try {
      if (user.provider !== "google.com") throw new ApiError(403, "google_sign_in_required");
      const body = await readJson(c);
      if (typeof body !== "object" || body === null || Array.isArray(body)) throw new ApiError(400, "bad_request");
      const b = body as { checkId?: unknown; state?: unknown; city?: unknown };
      if (typeof b.checkId !== "string" || !UUID_RE.test(b.checkId)) throw new ApiError(404, "not_found");

      const check = await deps.store.getCheck(b.checkId);
      if (!check) throw new ApiError(404, "not_found");
      if (check.uid !== user.uid) throw new ApiError(403, "google_sign_in_required");
      if (check.verdict === "no_signs") throw new ApiError(409, "not_reportable");
      const entityKeys = mergeKeys(check.entityKeys ?? []);
      if (entityKeys.length === 0) throw new ApiError(409, "no_identifiers");

      const stateName = typeof b.state === "string"
        ? INDIAN_STATES.find((s) => s.toLowerCase() === (b.state as string).trim().toLowerCase())
        : undefined;
      const cityRaw = typeof b.city === "string" ? b.city.trim() : "";
      const city = cityRaw && cityRaw.length <= 60 && CITY_RE.test(cityRaw) ? cityRaw : undefined;
      const scamType: ScamType = check.scam_type === "none" ? "other" : check.scam_type;

      const { reportId } = await deps.store.addReport({
        uid: user.uid, checkId: check.id, entityKeys, scamType, state: stateName, city, day: istDay(deps.now()),
      });
      if (check.storagePath) {
        try { await deps.copyEvidence(check.storagePath, reportId); } catch { logCode("evidence_copy_failed"); }
      }
      return reply(c, 200, { reportId, entityKeys });
    } catch (e) {
      if (e instanceof ApiError) return fail(c, e.status, e.code);
      logCode("report_failed");
      return fail(c, 500, "internal_error");
    }
  });

  app.notFound((c) => fail(c, 404, "not_found"));
  app.onError((_err, c) => {
    logCode("internal_error");
    return fail(c, 500, "internal_error");
  });

  return app;
}
