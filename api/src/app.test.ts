import { beforeEach, describe, expect, it, vi } from "vitest";
import QRCode from "qrcode";
import type { GeminiVerdict, LinkScan } from "@scam-shield/shared";
import { createApp, MAX_AUDIO_BYTES, MAX_IMAGE_BYTES, UploadNotFoundError, verhoeffValid } from "./app";
import type { AppDeps, AuthUser } from "./app";
import { AnalysisError } from "./gemini";
import type { AnalyzeInput, VerdictModel } from "./gemini";
import { MemoryStore } from "./store";
import type { EntityDoc, StoredCheck } from "./store";

const NOW = new Date("2026-10-16T09:00:00.000Z");
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SCAMMER = "+917000011111";
const UPI_URI = "upi://pay?pa=bnbreward.cashback@ybl&pn=Cashback%20Reward&am=5000&tn=Reward%20credit&cu=INR";

function verdict(over: Partial<GeminiVerdict> = {}): GeminiVerdict {
  return {
    verdict: "no_signs", risk_score: 10, scam_type: "none", summary: "No signs of a scam were found.",
    red_flags: [], next_steps: [],
    entities: { phones: [], upi_ids: [], urls: [], bank_accounts: [], brands_impersonated: [] },
    language: "en", ...over,
  };
}
function entityDoc(reportCount: number): EntityDoc {
  return { type: "phone", value: SCAMMER, reportCount, scamTypes: ["kyc_update"], linked: [], firstSeen: "2026-10-01T00:00:00.000Z", lastSeen: "2026-10-15T00:00:00.000Z" };
}

interface Ctx {
  app: ReturnType<typeof createApp>;
  deps: AppDeps;
  store: MemoryStore;
  analyze: ReturnType<typeof vi.fn<(i: AnalyzeInput) => Promise<GeminiVerdict>>>;
  scan: ReturnType<typeof vi.fn<(u: string, signal?: AbortSignal) => Promise<LinkScan>>>;
  uploads: Map<string, { bytes: Buffer; mimeType: string; size?: number }>;
  saveScreenshot: ReturnType<typeof vi.fn<(uid: string, id: string, jpeg: Buffer) => Promise<string>>>;
  copyEvidence: ReturnType<typeof vi.fn<(p: string, r: string) => Promise<void>>>;
}

let ipCounter = 0;
function setup(over: Partial<AppDeps> = {}): Ctx {
  const store = new MemoryStore({ now: () => NOW });
  const analyze = vi.fn<(i: AnalyzeInput) => Promise<GeminiVerdict>>(async () => verdict());
  const model: VerdictModel = { analyze };
  const scan = vi.fn<(u: string, signal?: AbortSignal) => Promise<LinkScan>>(async (u) => ({ requestedUrl: u, redirects: [], title: "Page", httpStatus: 200 }));
  const uploads = new Map<string, { bytes: Buffer; mimeType: string; size?: number }>();
  const saveScreenshot = vi.fn<(uid: string, id: string, jpeg: Buffer) => Promise<string>>(async (uid, id) => `screenshots/${uid}/${id}.jpg`);
  const copyEvidence = vi.fn<(p: string, r: string) => Promise<void>>(async () => {});
  const deps: AppDeps = {
    store, model, scanner: { scan },
    verifyToken: async (t): Promise<AuthUser> => {
      const [provider, uid] = t.split(":");
      if (!uid) throw new Error("bad token");
      return { uid, provider: provider === "google" ? "google.com" : "anonymous" };
    },
    readUpload: async (path) => {
      const u = uploads.get(path);
      if (!u) throw new UploadNotFoundError();
      return { bytes: u.bytes, gcsUri: `gs://bucket/${path}`, mimeType: u.mimeType, size: u.size ?? u.bytes.length };
    },
    saveScreenshot, copyEvidence,
    now: () => NOW,
    limits: { perUidPerDay: 30, globalPerDay: 3000, perIpPerMinute: 1000 },
    ...over,
  };
  return { app: createApp(deps), deps, store, analyze, scan, uploads, saveScreenshot, copyEvidence };
}

type Res = Omit<Response, "json"> & { json(): Promise<any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
interface ReqOpts { token?: string | null; ip?: string }
async function post(app: Ctx["app"], path: string, body: unknown, { token = "anon:u1", ip }: ReqOpts = {}): Promise<Res> {
  const headers: Record<string, string> = { "content-type": "application/json", "x-forwarded-for": ip ?? `10.0.0.${++ipCounter}` };
  if (token) headers.authorization = `Bearer ${token}`;
  return (await app.request(path, { method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body) })) as unknown as Res;
}
const check = (c: Ctx, body: unknown, o?: ReqOpts) => post(c.app, "/api/check", body, o);
const report = (c: Ctx, body: unknown, o?: ReqOpts) => post(c.app, "/api/report", body, o);

beforeEach(() => { ipCounter = 0; });

describe("GET /api/health", () => {
  it("returns ok", async () => {
    const c = setup();
    const res = await c.app.request("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("POST /api/check: validation and limits", () => {
  it("returns 401 without a token", async () => {
    const c = setup();
    expect((await check(c, { text: "hi", lang: "en" }, { token: null })).status).toBe(401);
    expect((await check(c, { text: "hi", lang: "en" }, { token: "garbage" })).status).toBe(401);
    expect(c.analyze).not.toHaveBeenCalled();
  });

  it("returns 400 empty_input for {lang:'en'}", async () => {
    const c = setup();
    const res = await check(c, { lang: "en" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "empty_input" });
    expect((await check(c, { text: "   ", lang: "en" })).status).toBe(400);
  });

  it("returns 400 text_too_long for 5001 chars", async () => {
    const c = setup();
    const res = await check(c, { text: "a".repeat(5001), lang: "en" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "text_too_long" });
    expect((await check(c, { text: "a".repeat(5000), lang: "en" })).status).toBe(200);
  });

  it("returns 400 for an oversized request body before parsing it", async () => {
    const c = setup();
    const res = await check(c, JSON.stringify({ text: "a".repeat(200_000), lang: "en" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "text_too_long" });
    expect(c.analyze).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON and wrong field types", async () => {
    const c = setup();
    expect((await check(c, "{not json")).status).toBe(400);
    expect((await check(c, { text: 42, lang: "en" })).status).toBe(400);
    expect((await check(c, [1, 2])).status).toBe(400);
  });

  it("returns 400 bad_url for non-http(s) and unparsable urls", async () => {
    const c = setup();
    for (const url of ["javascript:alert(1)", "ftp://example.com/x", "http://", "https://nodots", "x".repeat(3000)]) {
      const res = await check(c, { url, lang: "en" });
      expect(res.status, url).toBe(400);
      expect(await res.json()).toEqual({ error: "bad_url" });
    }
    expect(c.scan).not.toHaveBeenCalled();
  });

  it("accepts a bare domain by assuming https", async () => {
    const c = setup();
    const res = await check(c, { url: "bnb-kyc-update.web.app/login", lang: "en" });
    expect(res.status).toBe(200);
    expect(c.scan).toHaveBeenCalledWith("https://bnb-kyc-update.web.app/login", expect.any(AbortSignal));
  });

  it("returns 403 not_your_upload for storagePath uploads/other-uid/x.png", async () => {
    const c = setup();
    for (const storagePath of ["uploads/other-uid/x.png", "uploads/u1/../other/x.png", "uploads/u10/x.png", "other/u1/x.png"]) {
      const res = await check(c, { storagePath, mimeType: "image/png", lang: "en" });
      expect(res.status, storagePath).toBe(403);
      expect(await res.json()).toEqual({ error: "not_your_upload" });
    }
  });

  it("returns 400 unsupported_type for an unsupported MIME", async () => {
    const c = setup();
    c.uploads.set("uploads/u1/a.exe", { bytes: Buffer.from("MZ"), mimeType: "application/x-msdownload" });
    const res = await check(c, { storagePath: "uploads/u1/a.exe", lang: "en" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "unsupported_type" });
    expect(c.analyze).not.toHaveBeenCalled();
  });

  it("returns 400 file_too_large by reported size, without needing the bytes", async () => {
    const c = setup();
    c.uploads.set("uploads/u1/big.png", { bytes: Buffer.alloc(0), mimeType: "image/png", size: MAX_IMAGE_BYTES + 1 });
    c.uploads.set("uploads/u1/big.mp3", { bytes: Buffer.alloc(0), mimeType: "audio/mpeg", size: MAX_AUDIO_BYTES + 1 });
    for (const storagePath of ["uploads/u1/big.png", "uploads/u1/big.mp3"]) {
      const res = await check(c, { storagePath, lang: "en" });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "file_too_large" });
    }
  });

  it("returns 400 when the upload does not exist", async () => {
    const c = setup();
    const res = await check(c, { storagePath: "uploads/u1/nope.png", lang: "en" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "upload_not_found" });
  });

  it("returns 429 daily_limit on the 31st check of the day for one uid", async () => {
    const c = setup();
    for (let i = 1; i <= 30; i++) expect((await check(c, { text: `hello ${i}`, lang: "en" })).status, `#${i}`).toBe(200);
    const res = await check(c, { text: "hello 31", lang: "en" });
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "daily_limit" });
    // another user is unaffected
    expect((await check(c, { text: "hello", lang: "en" }, { token: "anon:u2" })).status).toBe(200);
  });

  it("returns 429 daily_limit when the global daily budget is spent", async () => {
    const c = setup({ limits: { perUidPerDay: 30, globalPerDay: 2, perIpPerMinute: 1000 } });
    expect((await check(c, { text: "a", lang: "en" }, { token: "anon:a" })).status).toBe(200);
    expect((await check(c, { text: "a", lang: "en" }, { token: "anon:b" })).status).toBe(200);
    const res = await check(c, { text: "a", lang: "en" }, { token: "anon:c" });
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "daily_limit" });
  });

  it("returns 429 rate_limited per client IP (first X-Forwarded-For entry)", async () => {
    const c = setup({ limits: { perUidPerDay: 30, globalPerDay: 3000, perIpPerMinute: 2 } });
    const ip = "203.0.113.9, 10.1.1.1";
    expect((await check(c, { text: "a", lang: "en" }, { ip })).status).toBe(200);
    expect((await check(c, { text: "a", lang: "en" }, { ip })).status).toBe(200);
    const res = await check(c, { text: "a", lang: "en" }, { ip: "203.0.113.9, 10.9.9.9" });
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "rate_limited" });
    expect((await check(c, { text: "a", lang: "en" }, { ip: "203.0.113.10" })).status).toBe(200);
  });

  it("still returns 200 when store.bumpUsage rejects (fail-open usage counting)", async () => {
    const c = setup();
    vi.spyOn(c.store, "bumpUsage").mockRejectedValue(new Error("ABORTED: too much contention on these documents"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await check(c, { text: "hello", lang: "en" });
    expect(res.status).toBe(200);
    expect(JSON.stringify(err.mock.calls)).not.toContain("contention");
    err.mockRestore();
  });
});

describe("POST /api/check: pipeline", () => {
  it("returns a verdict with hits and hardSignals for a text containing a twice-reported phone", async () => {
    const c = setup();
    c.store.putEntity(`phone:${SCAMMER}`, entityDoc(2));
    const res = await check(c, { text: `Call ${SCAMMER} to claim your reward`, lang: "en" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.verdict).toBe("scam");
    expect(body.hardSignals).toEqual(["multi_reported_entity"]);
    expect(body.hits).toHaveLength(1);
    expect(body.hits[0]).toMatchObject({ key: `phone:${SCAMMER}`, reportCount: 2 });
    expect(body.entityKeys).toEqual([`phone:${SCAMMER}`]);
    expect(body.inputKind).toBe("text");
    expect(body.id).toMatch(UUID_RE);
    expect(body.createdAt).toBe(NOW.toISOString());
    expect(typeof body.latencyMs).toBe("number");
    expect(c.analyze.mock.calls[0][0].hits).toHaveLength(1);
  });

  it("replaces a no_signs verdict raised by a reported entity with a localized reported note, flag and next step", async () => {
    const c = setup();
    c.store.putEntity(`phone:${SCAMMER}`, entityDoc(1));
    const body = await (await check(c, { text: `call ${SCAMMER}`, lang: "en" })).json();
    expect(body.verdict).toBe("suspicious");
    expect(body.hardSignals).toEqual(["reported_entity"]);
    expect(body.scam_type).toBe("other");
    expect(body.summary).toBe("This number/ID/link has been reported to Scam Shield before.");
    expect(body.summary).not.toMatch(/no signs/i);
    expect(body.red_flags).toHaveLength(1);
    expect(body.red_flags[0].evidence).toBe("+91 70XXXXX111 reported 1 time");
    expect(body.next_steps[0]).toBe("Do not pay or share any OTP/PIN. Call 1930 if you've lost money.");

    c.store.putEntity(`phone:${SCAMMER}`, entityDoc(3));
    const multi = await (await check(c, { text: `call ${SCAMMER}`, lang: "en" })).json();
    expect(multi.verdict).toBe("scam");
    expect(multi.summary).toBe("This number/ID/link has been reported to Scam Shield before.");
    expect(multi.red_flags[0].evidence).toBe("+91 70XXXXX111 reported 3 times");

    const hi = await (await check(c, { text: `call ${SCAMMER}`, lang: "hi" })).json();
    expect(hi.summary.startsWith("इस नंबर/आईडी/लिंक की Scam Shield पर पहले भी शिकायत")).toBe(true);
    expect(hi.summary).not.toMatch(/No signs/i);
    expect(hi.red_flags[0].flag).toMatch(/[ऀ-ॿ]/);
    expect(hi.next_steps[0]).toContain("1930");
    expect(hi.next_steps[0]).toMatch(/[ऀ-ॿ]/);
  });

  it("replaces a no_signs verdict raised by the QR signal with the pay-QR note, payee flag and next step", async () => {
    const c = setup();
    c.uploads.set("uploads/u1/qr.png", { bytes: await QRCode.toBuffer(UPI_URI, { width: 400 }), mimeType: "image/png" });
    const body = await (await check(c, { storagePath: "uploads/u1/qr.png", text: "Scan to receive your refund", lang: "en" })).json();
    expect(body.verdict).toBe("scam");
    expect(body.scam_type).toBe("qr_receive_scam");
    expect(body.summary).toBe("This QR asks you to PAY money, but the message says you will receive it.");
    expect(body.summary).not.toMatch(/no signs/i);
    expect(body.red_flags[0].evidence).toBe("Payee bnbreward.cashback@ybl, amount 5000");
    expect(body.next_steps[0]).toBe("Do not pay or share any OTP/PIN. Call 1930 if you've lost money.");

    const hi = await (await check(c, { storagePath: "uploads/u1/qr.png", text: "Scan to receive your refund", lang: "hi" })).json();
    expect(hi.summary).toMatch(/^यह QR आपसे पैसे भेजने/);
    expect(hi.red_flags[0].evidence).toContain("bnbreward.cashback@ybl");
    expect(hi.red_flags[0].evidence).toContain("5000");
  });

  it("does not touch the scam_type or summary when the model already flagged it", async () => {
    const c = setup();
    c.store.putEntity(`phone:${SCAMMER}`, entityDoc(1));
    c.analyze.mockResolvedValue(verdict({ verdict: "scam", risk_score: 90, scam_type: "kyc_update", summary: "Fake KYC message." }));
    const body = await (await check(c, { text: `call ${SCAMMER}`, lang: "en" })).json();
    expect(body).toMatchObject({ verdict: "scam", scam_type: "kyc_update", summary: "Fake KYC message." });
  });

  it("decodes a QR upload and sets qr.upi.pa", async () => {
    const c = setup();
    c.uploads.set("uploads/u1/qr.png", { bytes: await QRCode.toBuffer(UPI_URI, { width: 400 }), mimeType: "image/png" });
    const res = await check(c, { storagePath: "uploads/u1/qr.png", mimeType: "image/png", text: "Scan to receive your refund", lang: "en" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.inputKind).toBe("image");
    expect(body.qr.upi.pa).toBe("bnbreward.cashback@ybl");
    expect(body.entityKeys).toContain("upi:bnbreward.cashback@ybl");
    expect(body.hardSignals).toContain("qr_pay_disguised_as_receive");
    expect(body.verdict).toBe("scam");
    const input = c.analyze.mock.calls[0][0];
    expect(input.media).toEqual({ gcsUri: "gs://bucket/uploads/u1/qr.png", mimeType: "image/png" });
    expect(input.qr?.upi?.pa).toBe("bnbreward.cashback@ybl");
  });

  it("treats audio uploads as audio and hands them to the model by gcs uri", async () => {
    const c = setup();
    c.uploads.set("uploads/u1/call.mp3", { bytes: Buffer.from("fake-audio"), mimeType: "audio/mpeg" });
    const body = await (await check(c, { storagePath: "uploads/u1/call.mp3", lang: "en" })).json();
    expect(body.inputKind).toBe("audio");
    expect(c.analyze.mock.calls[0][0].media).toEqual({ gcsUri: "gs://bucket/uploads/u1/call.mp3", mimeType: "audio/mpeg" });
  });

  it("inputKind is link when a url is given", async () => {
    const c = setup();
    expect((await (await check(c, { url: "https://bnb-kyc-update.web.app", lang: "en" })).json()).inputKind).toBe("link");
  });

  it("scans the explicit url, else the first url in the text, in parallel with the scam-list lookup", async () => {
    const c = setup();
    await check(c, { url: "https://explicit.example/a", text: "see https://other.example/b", lang: "en" });
    expect(c.scan).toHaveBeenLastCalledWith("https://explicit.example/a", expect.any(AbortSignal));
    await check(c, { text: "verify at https://first.example/x or https://second.example/y", lang: "en" });
    expect(c.scan).toHaveBeenLastCalledWith("https://first.example/x", expect.any(AbortSignal));
    c.scan.mockClear();
    await check(c, { text: "no links here", lang: "en" });
    expect(c.scan).not.toHaveBeenCalled();

    // Parallelism proof: the lookup only completes once the scan has started, so a sequential
    // implementation (lookup, then scan) would never finish.
    let scanStarted!: () => void;
    const started = new Promise<void>((r) => (scanStarted = r));
    c.scan.mockImplementation(async (u) => { scanStarted(); return { requestedUrl: u, redirects: [] }; });
    vi.spyOn(c.store, "getHits").mockImplementation(async () => { await started; return []; });
    expect((await check(c, { url: "https://par.example", lang: "en" })).status).toBe(200);
  });

  it("still returns a verdict when the link scan fails", async () => {
    const c = setup();
    c.scan.mockResolvedValue({ requestedUrl: "https://bnb-kyc-update.web.app", redirects: [], blockedReason: "scan_failed" });
    const res = await check(c, { url: "https://bnb-kyc-update.web.app", lang: "en" });
    expect(res.status).toBe(200);
    expect((await res.json()).linkScan.blockedReason).toBe("scan_failed");
    expect(c.analyze).toHaveBeenCalledOnce();
  });

  it("still returns a verdict when the scanner throws", async () => {
    const c = setup();
    c.scan.mockRejectedValue(new Error("kaboom"));
    const res = await check(c, { url: "https://bnb-kyc-update.web.app", lang: "en" });
    expect(res.status).toBe(200);
    expect((await res.json()).linkScan).toEqual({ requestedUrl: "https://bnb-kyc-update.web.app", redirects: [], blockedReason: "scan_failed" });
  });

  it("returns 502 analysis_failed when the model throws, and does not save the check", async () => {
    const c = setup();
    c.analyze.mockRejectedValue(new AnalysisError("Gemini call failed: secret-project-123 quota"));
    const save = vi.spyOn(c.store, "saveCheck");
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await check(c, { text: "hello", lang: "en" });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "analysis_failed" });
    expect(save).not.toHaveBeenCalled();
    expect(JSON.stringify(err.mock.calls)).not.toContain("secret-project");
    err.mockRestore();
  });

  it("returns 502 analysis_failed when the whole check exceeds the time limit, and never saves", async () => {
    const c = setup({ checkTimeoutMs: 30 });
    c.analyze.mockImplementation(() => new Promise(() => {}));
    const save = vi.spyOn(c.store, "saveCheck");
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await check(c, { text: "hello", lang: "en" });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "analysis_failed" });
    expect(save).not.toHaveBeenCalled();
    err.mockRestore();
  });

  it("never leaks error messages or stack traces from unexpected failures", async () => {
    const c = setup();
    vi.spyOn(c.store, "getHits").mockRejectedValue(new Error("secret db password in /srv/app/store.ts"));
    c.analyze.mockImplementation(() => { throw new TypeError("secret stack /srv/app/gemini.ts"); });
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await check(c, { text: "hello user text 9876543210", lang: "en" });
    const raw = await res.text();
    expect(res.status).toBe(502);
    expect(raw).toBe('{"error":"analysis_failed"}');
    const logged = JSON.stringify(err.mock.calls);
    expect(logged).not.toContain("secret");
    expect(logged).not.toContain("9876543210");
    err.mockRestore();
  });

  it("continues without hits when the scam-list lookup fails", async () => {
    const c = setup();
    vi.spyOn(c.store, "getHits").mockRejectedValue(new Error("firestore down"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await check(c, { text: `call ${SCAMMER}`, lang: "en" });
    expect(res.status).toBe(200);
    expect((await res.json()).hits).toEqual([]);
    err.mockRestore();
  });

  it("caps entity keys at 20 per check", async () => {
    const c = setup();
    const phones = Array.from({ length: 30 }, (_, i) => `+91 70000 ${String(10000 + i)}`);
    const getHits = vi.spyOn(c.store, "getHits");
    const body = await (await check(c, { text: phones.join(" , "), lang: "en" })).json();
    expect(body.entityKeys).toHaveLength(20);
    expect(getHits.mock.calls[0][0]).toHaveLength(20);
  });

  it("drops entity keys longer than 200 characters", async () => {
    const c = setup();
    const longUpi = `${"a".repeat(220)}@ybl`;
    const body = await (await check(c, { text: `pay ${longUpi} or ${SCAMMER}`, lang: "en" })).json();
    expect(body.entityKeys).toEqual([`phone:${SCAMMER}`]);
  });

  it("merges identifiers returned by Gemini into entityKeys and re-checks them against the scam list", async () => {
    const c = setup();
    c.store.putEntity("phone:+917000022222", { ...entityDoc(2), value: "+917000022222" });
    c.uploads.set("uploads/u1/shot.png", { bytes: await QRCode.toBuffer("hello", { width: 200 }), mimeType: "image/png" });
    c.analyze.mockResolvedValue(verdict({
      entities: { phones: ["70000 22222"], upi_ids: ["Fraud.Agent@OKSBI"], urls: ["https://scam-site.example/login"], bank_accounts: ["1234 5678 9012"], brands_impersonated: [] },
    }));
    const body = await (await check(c, { storagePath: "uploads/u1/shot.png", lang: "en" })).json();
    expect(body.entityKeys).toEqual(expect.arrayContaining([
      "phone:+917000022222", "upi:fraud.agent@oksbi", "domain:scam-site.example", "acct:123456789012",
    ]));
    expect(new Set(body.entityKeys).size).toBe(body.entityKeys.length);
    expect(body.hits.map((h: { key: string }) => h.key)).toContain("phone:+917000022222");
    expect(body.hardSignals).toEqual(["multi_reported_entity"]);
    expect(body.verdict).toBe("scam");
  });

  it("never turns an Aadhaar-valid or card-like number returned by Gemini into an entity key", async () => {
    expect(verhoeffValid("2363")).toBe(true);
    expect(verhoeffValid("2364")).toBe(false);
    const c = setup();
    c.analyze.mockResolvedValue(verdict({
      entities: { phones: [], upi_ids: [], urls: [], bank_accounts: ["2345 6789 0124", "4111 1111 1111 1111", "123456789012"], brands_impersonated: [] },
    }));
    const body = await (await check(c, { text: "hello", lang: "en" })).json();
    expect(body.entityKeys).toEqual(["acct:123456789012"]);
  });

  it("de-duplicates keys found by both the extractor and Gemini", async () => {
    const c = setup();
    c.analyze.mockResolvedValue(verdict({ entities: { phones: [SCAMMER], upi_ids: [], urls: [], bank_accounts: [], brands_impersonated: [] } }));
    const body = await (await check(c, { text: `call ${SCAMMER}`, lang: "en" })).json();
    expect(body.entityKeys).toEqual([`phone:${SCAMMER}`]);
  });

  it("stores a redacted copy: no raw text, no OTP, kept scammer identifiers, no screenshot data URL", async () => {
    const c = setup();
    const shot = `data:image/jpeg;base64,${Buffer.from("jpegbytes").toString("base64")}`;
    c.scan.mockResolvedValue({ requestedUrl: "https://bnb-kyc.example", redirects: [], title: "Login", text: "x".repeat(10000), screenshotDataUrl: shot });
    c.analyze.mockResolvedValue(verdict({ summary: "They asked for OTP 482913.", transcript: "your OTP is 482913" }));
    const res = await check(c, { text: `Share OTP 482913 with ${SCAMMER} at https://bnb-kyc.example`, lang: "en" });
    const body = await res.json();
    expect(body.linkScan.screenshotDataUrl).toBe(shot);
    const stored = (await c.store.getCheck(body.id)) as StoredCheck & { text?: string };
    expect(stored.uid).toBe("u1");
    expect(stored.text).toBeUndefined();
    expect(stored.redactedText).toContain(SCAMMER);
    expect(stored.redactedText).not.toContain("482913");
    expect(stored.summary).not.toContain("482913");
    expect(stored.transcript).not.toContain("482913");
    expect(stored.linkScan?.screenshotDataUrl).toBeUndefined();
    expect(stored.linkScan?.text?.length).toBeLessThanOrEqual(3000);
    expect(stored.screenshotPath).toBe(`screenshots/u1/${body.id}.jpg`);
    expect(JSON.stringify(stored)).not.toContain("jpegbytes");
    expect(c.saveScreenshot).toHaveBeenCalledWith("u1", body.id, Buffer.from("jpegbytes"));
  });

  it("keeps going when saving the screenshot fails", async () => {
    const c = setup();
    c.scan.mockResolvedValue({ requestedUrl: "https://a.example", redirects: [], screenshotDataUrl: "data:image/jpeg;base64,AAAA" });
    c.saveScreenshot.mockRejectedValue(new Error("gcs down"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await check(c, { url: "https://a.example", lang: "en" });
    expect(res.status).toBe(200);
    expect(((await c.store.getCheck((await res.json()).id)) as StoredCheck).screenshotPath).toBeUndefined();
    err.mockRestore();
  });

  it("records the upload path on the stored check", async () => {
    const c = setup();
    c.uploads.set("uploads/u1/a.png", { bytes: await QRCode.toBuffer("hi", { width: 200 }), mimeType: "image/png" });
    const body = await (await check(c, { storagePath: "uploads/u1/a.png", lang: "en" })).json();
    expect(((await c.store.getCheck(body.id)) as StoredCheck).storagePath).toBe("uploads/u1/a.png");
  });
});

describe("responses", () => {
  it("sends Cache-Control: no-store on every /api response, including errors", async () => {
    const c = setup();
    const ok = await c.app.request("/api/health");
    const unauth = await check(c, { text: "x", lang: "en" }, { token: null });
    const bad = await check(c, { lang: "en" });
    const good = await check(c, { text: "x", lang: "en" });
    const missing = await c.app.request("/api/nope");
    for (const r of [ok, unauth, bad, good, missing]) {
      expect(r.headers.get("cache-control")).toBe("no-store");
      expect(r.headers.get("content-type")).toContain("application/json");
      expect(r.headers.get("access-control-allow-origin")).toBeNull();
    }
    expect(missing.status).toBe(404);
  });
});

describe("POST /api/report", () => {
  async function checked(c: Ctx, over: Partial<GeminiVerdict> = {}, text = `Claim reward: call ${SCAMMER}`, token = "google:g1") {
    c.analyze.mockResolvedValue(verdict({ verdict: "scam", risk_score: 90, scam_type: "kyc_update", summary: "Fake.", ...over }));
    return (await (await check(c, { text, lang: "en" }, { token })).json()) as { id: string; entityKeys: string[] };
  }

  it("403 google_sign_in_required for anonymous users", async () => {
    const c = setup();
    const { id } = await checked(c, {}, undefined, "anon:u1");
    const res = await report(c, { checkId: id }, { token: "anon:u1" });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "google_sign_in_required" });
  });

  it("401 without a token", async () => {
    const c = setup();
    expect((await report(c, { checkId: "x" }, { token: null })).status).toBe(401);
  });

  it("403 google_sign_in_required when the check is not the caller's", async () => {
    const c = setup();
    const { id } = await checked(c, {}, undefined, "google:g1");
    const res = await report(c, { checkId: id }, { token: "google:g2" });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "google_sign_in_required" });
  });

  it("404 for an unknown check id, and for a non-UUID id before any store call", async () => {
    const c = setup();
    const getCheck = vi.spyOn(c.store, "getCheck");
    const addReport = vi.spyOn(c.store, "addReport");
    expect((await report(c, { checkId: "11111111-1111-4111-8111-111111111111" }, { token: "google:g1" })).status).toBe(404);
    expect(getCheck).toHaveBeenCalledTimes(1);
    getCheck.mockClear();
    for (const checkId of ["../../etc/passwd", "abc", "", 42, null, "a/b", "1".repeat(36)]) {
      const res = await report(c, { checkId }, { token: "google:g1" });
      expect(res.status, String(checkId)).toBe(404);
    }
    expect(getCheck).not.toHaveBeenCalled();
    expect(addReport).not.toHaveBeenCalled();
  });

  it("409 not_reportable for a no_signs check", async () => {
    const c = setup();
    const { id } = await checked(c, { verdict: "no_signs", risk_score: 5, scam_type: "none" });
    const res = await report(c, { checkId: id }, { token: "google:g1" });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "not_reportable" });
  });

  it("409 no_identifiers without calling addReport when the check has no entity keys", async () => {
    const c = setup();
    const { id } = await checked(c, {}, "Your account is blocked, act now");
    const addReport = vi.spyOn(c.store, "addReport");
    const res = await report(c, { checkId: id }, { token: "google:g1" });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "no_identifiers" });
    expect(addReport).not.toHaveBeenCalled();
  });

  it("200 and counts entities for a google user", async () => {
    const c = setup();
    const { id, entityKeys } = await checked(c);
    expect(entityKeys).toEqual([`phone:${SCAMMER}`]);
    const res = await report(c, { checkId: id, state: "Maharashtra", city: "Pune" }, { token: "google:g1" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reportId).toMatch(UUID_RE);
    expect(body.entityKeys).toEqual([`phone:${SCAMMER}`]);
    expect((await c.store.getHits([`phone:${SCAMMER}`]))[0]).toMatchObject({ reportCount: 1, scamTypes: ["kyc_update"] });
    expect((await c.store.getDailyStats("2026-10-16"))?.byState).toEqual({ Maharashtra: 1 });
    expect(c.store.reports[0]).toMatchObject({ checkId: id, scamType: "kyc_update", state: "Maharashtra", city: "Pune", day: "2026-10-16" });
    // reporting the same check twice does not double count
    await report(c, { checkId: id }, { token: "google:g1" });
    expect((await c.store.getHits([`phone:${SCAMMER}`]))[0].reportCount).toBe(1);
  });

  it("uses the IST day for the report", async () => {
    const late = new Date("2026-10-16T19:00:00.000Z"); // 00:30 on the 17th in IST
    const c = setup({ now: () => late });
    const { id } = await checked(c);
    await report(c, { checkId: id }, { token: "google:g1" });
    expect(c.store.reports[0]).toMatchObject({ day: "2026-10-17" });
  });

  it("maps a 'none' scam type to 'other' for suspicious checks", async () => {
    const c = setup();
    const { id } = await checked(c, { verdict: "suspicious", risk_score: 50, scam_type: "none" });
    await report(c, { checkId: id }, { token: "google:g1" });
    expect(c.store.reports[0]).toMatchObject({ scamType: "other" });
  });

  it("copies the evidence upload when the check had one", async () => {
    const c = setup();
    c.uploads.set("uploads/g1/s.png", { bytes: await QRCode.toBuffer(UPI_URI, { width: 400 }), mimeType: "image/png" });
    c.analyze.mockResolvedValue(verdict({ verdict: "scam", risk_score: 90, scam_type: "qr_receive_scam" }));
    const { id } = await (await check(c, { storagePath: "uploads/g1/s.png", lang: "en" }, { token: "google:g1" })).json();
    const res = await report(c, { checkId: id }, { token: "google:g1" });
    const { reportId } = await res.json();
    expect(c.copyEvidence).toHaveBeenCalledWith("uploads/g1/s.png", reportId);
  });

  it("still succeeds when copying evidence fails", async () => {
    const c = setup();
    c.uploads.set("uploads/g1/s.png", { bytes: await QRCode.toBuffer(UPI_URI, { width: 400 }), mimeType: "image/png" });
    c.analyze.mockResolvedValue(verdict({ verdict: "scam", risk_score: 90, scam_type: "qr_receive_scam" }));
    const { id } = await (await check(c, { storagePath: "uploads/g1/s.png", lang: "en" }, { token: "google:g1" })).json();
    c.copyEvidence.mockRejectedValue(new Error("gcs"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await report(c, { checkId: id }, { token: "google:g1" })).status).toBe(200);
    err.mockRestore();
  });

  it("validates state against the Indian states/UTs list and drops anything else", async () => {
    const cases: Array<[unknown, string | undefined]> = [
      ["Maharashtra", "Maharashtra"], ["  tamil nadu ", "Tamil Nadu"], ["DELHI", "Delhi"],
      ["Atlantis", undefined], ["<script>alert(1)</script>", undefined], [42, undefined], [undefined, undefined], ["", undefined],
      ["Maharashtra; DROP", undefined],
    ];
    for (const [state, expected] of cases) {
      const c = setup();
      const { id } = await checked(c);
      const addReport = vi.spyOn(c.store, "addReport");
      expect((await report(c, { checkId: id, state }, { token: "google:g1" })).status).toBe(200);
      expect(addReport.mock.calls[0][0].state, String(state)).toBe(expected);
    }
  });

  it("sanitises city: trim, max 60 chars, letters/spaces/.-' only, else dropped", async () => {
    const cases: Array<[unknown, string | undefined]> = [
      [" Pune ", "Pune"], ["Navi Mumbai", "Navi Mumbai"], ["St. John's-Town", "St. John's-Town"], ["पुणे", "पुणे"],
      ["a".repeat(61), undefined], ["a".repeat(60), "a".repeat(60)], ["Pune<img>", undefined], ["Pune 411001", undefined],
      ["", undefined], [{ x: 1 }, undefined],
    ];
    for (const [city, expected] of cases) {
      const c = setup();
      const { id } = await checked(c);
      const addReport = vi.spyOn(c.store, "addReport");
      expect((await report(c, { checkId: id, city }, { token: "google:g1" })).status).toBe(200);
      expect(addReport.mock.calls[0][0].city, String(city)).toBe(expected);
    }
  });

  it("returns only {reportId, entityKeys}: no uid, no check contents", async () => {
    const c = setup();
    const { id } = await checked(c);
    const body = await (await report(c, { checkId: id }, { token: "google:g1" })).json();
    expect(Object.keys(body).sort()).toEqual(["entityKeys", "reportId"]);
  });
});

describe("usage accounting", () => {
  const probe = (c: Ctx) => c.store.bumpUsage("probe", "2026-10-16");

  it("requests rejected by the per-uid daily limit do not consume the global budget", async () => {
    const c = setup({ limits: { perUidPerDay: 3, globalPerDay: 3000, perIpPerMinute: 1000 } });
    for (let i = 0; i < 8; i++) await check(c, { text: `hello ${i}`, lang: "en" });
    const p = await probe(c);
    expect(p.globalCount).toBe(4); // 3 allowed checks + this probe; the 5 rejected ones did not count
  });

  it("passes the per-uid limit to bumpUsage", async () => {
    const c = setup();
    const bump = vi.spyOn(c.store, "bumpUsage");
    await check(c, { text: "hello", lang: "en" });
    expect(bump).toHaveBeenCalledWith("u1", "2026-10-16", 30);
  });

  it("does not consume quota for validation failures, missing or unsupported uploads", async () => {
    const c = setup();
    const bump = vi.spyOn(c.store, "bumpUsage");
    c.uploads.set("uploads/u1/a.exe", { bytes: Buffer.from("MZ"), mimeType: "application/x-msdownload" });
    c.uploads.set("uploads/u1/big.png", { bytes: Buffer.alloc(0), mimeType: "image/png", size: MAX_IMAGE_BYTES + 1 });
    c.uploads.set("uploads/u1/notype.png", { bytes: Buffer.from("x"), mimeType: "" });
    const bodies: Array<[Record<string, unknown>, number]> = [
      [{ lang: "en" }, 400], [{ text: "a".repeat(5001), lang: "en" }, 400], [{ url: "javascript:x", lang: "en" }, 400],
      [{ storagePath: "uploads/u1/nope.png", lang: "en" }, 400], [{ storagePath: "uploads/u1/a.exe", lang: "en" }, 400],
      [{ storagePath: "uploads/u1/big.png", lang: "en" }, 400],
      [{ storagePath: "uploads/u1/notype.png", mimeType: "image/png", lang: "en" }, 400],
      [{ storagePath: "uploads/other/x.png", lang: "en" }, 403],
    ];
    for (const [body, status] of bodies) expect((await check(c, body)).status, JSON.stringify(body)).toBe(status);
    expect(bump).not.toHaveBeenCalled();
    expect(await probe(c)).toEqual({ uidCount: 1, globalCount: 1 });
  });

  it("downloads the upload only after the usage check (metadata first)", async () => {
    const c = setup({ limits: { perUidPerDay: 1, globalPerDay: 3000, perIpPerMinute: 1000 } });
    c.uploads.set("uploads/u1/a.png", { bytes: Buffer.from("x"), mimeType: "image/png" });
    const read = vi.spyOn(c.deps, "readUpload");
    await check(c, { text: "first", lang: "en" });
    read.mockClear();
    const res = await check(c, { storagePath: "uploads/u1/a.png", lang: "en" });
    expect(res.status).toBe(429);
    expect(read).toHaveBeenCalled();
    expect(read.mock.calls.every((call) => call[1]?.metadataOnly === true)).toBe(true);
  });

  it("trusts only the stored contentType: empty means unsupported_type even when the client claims an image", async () => {
    const c = setup();
    c.uploads.set("uploads/u1/x", { bytes: Buffer.from("x"), mimeType: "" });
    const res = await check(c, { storagePath: "uploads/u1/x", mimeType: "image/png", lang: "en" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "unsupported_type" });
  });

  it("accepts exactly the spec MIME types", async () => {
    const c = setup();
    const ok = ["image/png", "image/jpeg", "image/webp", "audio/mpeg", "audio/mp4", "audio/aac", "audio/ogg", "audio/wav", "audio/webm"];
    const bad = ["audio/mp3", "audio/x-wav", "audio/wave", "audio/x-m4a", "audio/m4a", "audio/flac", "image/gif", "image/heic"];
    const p = (m: string) => `uploads/u1/f-${m.replace("/", "_")}`;
    for (const m of [...ok, ...bad]) c.uploads.set(p(m), { bytes: Buffer.from("x"), mimeType: m });
    for (const m of ok) expect((await check(c, { storagePath: p(m), lang: "en" })).status, m).toBe(200);
    for (const m of bad) expect((await check(c, { storagePath: p(m), lang: "en" })).status, m).toBe(400);
  });

  it("allows images up to 10 MB and audio up to 15 MB", () => {
    expect(MAX_IMAGE_BYTES).toBe(10 * 1024 * 1024);
    expect(MAX_AUDIO_BYTES).toBe(15 * 1024 * 1024);
  });

  it("maps unexpected readUpload failures to 502 internal_error without consuming quota", async () => {
    const c = setup();
    const bump = vi.spyOn(c.store, "bumpUsage");
    vi.spyOn(c.deps, "readUpload").mockRejectedValue(new Error("storage exploded at /srv/x"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await check(c, { storagePath: "uploads/u1/a.png", lang: "en" });
    expect(res.status).toBe(502);
    expect(await res.text()).toBe('{"error":"internal_error"}');
    expect(bump).not.toHaveBeenCalled();
    expect(JSON.stringify(err.mock.calls)).not.toContain("exploded");
    err.mockRestore();
  });

  it("passes an abort signal to the scanner that fires when the check times out", async () => {
    const c = setup({ checkTimeoutMs: 30 });
    let seen: AbortSignal | undefined;
    c.scan.mockImplementation(async (u, signal) => { seen = signal; return { requestedUrl: u, redirects: [] }; });
    c.analyze.mockImplementation(() => new Promise(() => {}));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await check(c, { url: "https://a.example", lang: "en" });
    expect(res.status).toBe(502);
    expect(seen).toBeInstanceOf(AbortSignal);
    expect(seen!.aborted).toBe(true);
    err.mockRestore();
  });
});

describe("rate limiting by client ip", () => {
  const limits = { perUidPerDay: 1000, globalPerDay: 100000, perIpPerMinute: 2 };

  it("uses the TRUSTED_PROXY_HOPS-th entry (default 2) from the right, so a spoofed first entry cannot dodge the limit", async () => {
    const c = setup({ limits });
    const via = (spoof: string) => `${spoof}, 198.51.100.7, 35.191.0.1`;
    expect((await check(c, { text: "a", lang: "en" }, { ip: via("1.1.1.1") })).status).toBe(200);
    expect((await check(c, { text: "a", lang: "en" }, { ip: via("2.2.2.2") })).status).toBe(200);
    expect((await check(c, { text: "a", lang: "en" }, { ip: via("3.3.3.3") })).status).toBe(429);
    // a different real client is unaffected
    expect((await check(c, { text: "a", lang: "en" }, { ip: "9.9.9.9, 198.51.100.8, 35.191.0.1" })).status).toBe(200);
  });

  it("honours a configured hop count and falls back to the first entry when there are fewer", async () => {
    const c = setup({ limits, trustedProxyHops: 1 });
    expect((await check(c, { text: "a", lang: "en" }, { ip: "1.1.1.1, 10.0.0.1" })).status).toBe(200);
    expect((await check(c, { text: "a", lang: "en" }, { ip: "2.2.2.2, 10.0.0.1" })).status).toBe(200);
    expect((await check(c, { text: "a", lang: "en" }, { ip: "3.3.3.3, 10.0.0.1" })).status).toBe(429);
    const d = setup({ limits });
    for (let i = 0; i < 2; i++) expect((await check(d, { text: "a", lang: "en" }, { ip: "5.5.5.5" })).status).toBe(200);
    expect((await check(d, { text: "a", lang: "en" }, { ip: "5.5.5.5" })).status).toBe(429);
  });

  it("gives /api/report its own looser limiter (60/min by default)", async () => {
    const c = setup({ limits });
    const ip = "7.7.7.7";
    for (let i = 0; i < 2; i++) expect((await check(c, { text: "a", lang: "en" }, { ip })).status).toBe(200);
    expect((await check(c, { text: "a", lang: "en" }, { ip })).status).toBe(429);
    // report calls from the same ip are not blocked by the exhausted check bucket
    for (let i = 0; i < 60; i++) expect((await report(c, { checkId: "nope" }, { ip, token: "google:g1" })).status).toBe(404);
    expect((await report(c, { checkId: "nope" }, { ip, token: "google:g1" })).status).toBe(429);
  });
});

describe("auth header", () => {
  it("accepts a lowercase or oddly spaced bearer scheme and rejects other schemes", async () => {
    const c = setup();
    const call = (h: string) => c.app.request("/api/check", {
      method: "POST", headers: { authorization: h, "content-type": "application/json", "x-forwarded-for": `10.1.0.${++ipCounter}` },
      body: JSON.stringify({ text: "hi", lang: "en" }),
    });
    for (const h of ["bearer anon:u1", "BEARER   anon:u1", "Bearer anon:u1"]) expect((await call(h)).status, h).toBe(200);
    for (const h of ["Basic anon:u1", "Bearer", "anon:u1", "Bearer a b"]) expect((await call(h)).status, h).toBe(401);
  });
});

describe("stored check hygiene", () => {
  it("never stores Gemini's raw entities: filtered to the final keys, no Aadhaar or card numbers anywhere", async () => {
    const c = setup();
    c.analyze.mockResolvedValue(verdict({
      summary: "Scam. Aadhaar 2345 6789 0124 and card 4111 1111 1111 1111 were shown.",
      entities: {
        phones: ["70000 22222"], upi_ids: ["xyz@ybl"], urls: ["https://scam-site.example/login?token=secret"],
        bank_accounts: ["2345 6789 0124", "4111 1111 1111 1111", "123456789012"], brands_impersonated: ["BNB"],
      },
    }));
    const body = await (await check(c, { text: "hello", lang: "en" })).json();
    const stored = (await c.store.getCheck(body.id)) as StoredCheck;
    const raw = JSON.stringify(stored);
    for (const s of ["234567890124", "2345 6789 0124", "2345-6789-0124", "4111111111111111", "4111 1111 1111 1111", "token=secret", "70000 22222"]) expect(raw, s).not.toContain(s);
    expect(stored.entities.bank_accounts).toEqual(["123456789012"]);
    expect(stored.entities.phones).toEqual(["+917000022222"]);
    expect(stored.entities.upi_ids).toEqual(["xyz@ybl"]);
    expect(stored.entities.urls).toEqual(["scam-site.example"]);
    expect(stored.entities.brands_impersonated).toEqual(["BNB"]);
    // the HTTP response still shows the user what the model saw
    expect(body.entities.phones).toEqual(["70000 22222"]);
  });

  it("stores empty entity lists when no identifiers were found", async () => {
    const c = setup();
    c.analyze.mockResolvedValue(verdict({ entities: { phones: [], upi_ids: [], urls: [], bank_accounts: ["4111 1111 1111 1111"], brands_impersonated: [] } }));
    const body = await (await check(c, { text: "hello", lang: "en" })).json();
    const stored = (await c.store.getCheck(body.id)) as StoredCheck;
    expect(stored.entities).toEqual({ phones: [], upi_ids: [], urls: [], bank_accounts: [], brands_impersonated: [] });
  });
});
