import { describe, expect, it } from "vitest";
import { createIdTokenProvider, createLinkScanClient } from "./linkscanClient";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function client(fetchImpl: typeof fetch, timeoutMs = 1000) {
  return createLinkScanClient("https://linkscan.example.run.app", timeoutMs, { fetch: fetchImpl, getIdToken: async () => "tok" });
}

describe("createLinkScanClient", () => {
  it("POSTs the url to /scan with a bearer ID token and returns the scan", async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    const c = client(async (url, init) => { seen = { url: String(url), init: init! }; return json({ requestedUrl: "https://a.example", redirects: [], title: "T", httpStatus: 200 }); });
    const r = await c.scan("https://a.example");
    expect(r).toMatchObject({ requestedUrl: "https://a.example", title: "T", httpStatus: 200, redirects: [] });
    expect(seen!.url).toBe("https://linkscan.example.run.app/scan");
    expect(seen!.init.method).toBe("POST");
    expect((seen!.init.headers as Record<string, string>).authorization).toBe("Bearer tok");
    expect(JSON.parse(seen!.init.body as string)).toEqual({ url: "https://a.example" });
  });

  it("never throws: network errors become scan_failed", async () => {
    const c = client(async () => { throw new Error("boom"); });
    expect(await c.scan("https://a.example")).toEqual({ requestedUrl: "https://a.example", redirects: [], blockedReason: "scan_failed" });
  });

  it("maps non-2xx and malformed bodies to scan_failed", async () => {
    expect((await client(async () => json({ error: "x" }, 500)).scan("https://a.example")).blockedReason).toBe("scan_failed");
    expect((await client(async () => json({ nonsense: true })).scan("https://a.example")).blockedReason).toBe("scan_failed");
  });

  it("maps a failed token fetch to scan_failed", async () => {
    const c = createLinkScanClient("https://x.example", 1000, { fetch: async () => json({}), getIdToken: async () => { throw new Error("no creds"); } });
    expect((await c.scan("https://a.example")).blockedReason).toBe("scan_failed");
  });

  it("times out slow scans", async () => {
    const c = client((_u, init) => new Promise((_res, rej) => init!.signal!.addEventListener("abort", () => rej(new Error("aborted")))), 20);
    expect((await c.scan("https://a.example")).blockedReason).toBe("scan_failed");
  });

  it("passes through the scanner's own blockedReason and drops unknown fields", async () => {
    const c = client(async () => json({ requestedUrl: "http://10.0.0.1", redirects: [], blockedReason: "private_address", evil: "x" }));
    const r = await c.scan("http://10.0.0.1");
    expect(r.blockedReason).toBe("private_address");
    expect(r).not.toHaveProperty("evil");
  });

  it("keeps only http(s) URLs in finalUrl and redirects", async () => {
    const c = client(async () => json({
      requestedUrl: "https://a.example", finalUrl: "javascript:alert(1)",
      redirects: ["https://b.example/x", "javascript:alert(1)", "data:text/html,hi", "ftp://c.example", "http://d.example", 42],
    }));
    const r = await c.scan("https://a.example");
    expect(r.redirects).toEqual(["https://b.example/x", "http://d.example"]);
    expect(r.finalUrl).toBeUndefined();
    const ok = await client(async () => json({ requestedUrl: "https://a.example", finalUrl: "https://z.example/p", redirects: [] })).scan("https://a.example");
    expect(ok.finalUrl).toBe("https://z.example/p");
  });

  it("aborts when the caller's signal fires", async () => {
    const c = client((_u, init) => new Promise((_res, rej) => init!.signal!.addEventListener("abort", () => rej(new Error("aborted")))), 5000);
    const ctrl = new AbortController();
    const p = c.scan("https://a.example", ctrl.signal);
    ctrl.abort();
    expect((await p).blockedReason).toBe("scan_failed");
    const pre = new AbortController(); pre.abort();
    expect((await c.scan("https://a.example", pre.signal)).blockedReason).toBe("scan_failed");
  });
});

describe("createIdTokenProvider", () => {
  it("creates the ID-token client once per audience and reuses it (no new token fetch per scan)", async () => {
    let created = 0, headerCalls = 0;
    const auth = {
      async getIdTokenClient(aud: string) {
        created++;
        return { async getRequestHeaders() { headerCalls++; return new Headers({ authorization: `Bearer tok-for-${aud}` }); } };
      },
    };
    const get = createIdTokenProvider(auth);
    expect(await get("https://svc.example")).toBe("tok-for-https://svc.example");
    expect(await get("https://svc.example")).toBe("tok-for-https://svc.example");
    expect(await get("https://svc.example")).toBe("tok-for-https://svc.example");
    expect(created).toBe(1);
    expect(headerCalls).toBe(3); // the client itself caches the token until it nears expiry
  });

  it("accepts plain-object headers, and retries client creation after a failure", async () => {
    let n = 0;
    const auth = {
      async getIdTokenClient() {
        if (n++ === 0) throw new Error("metadata server unavailable");
        return { async getRequestHeaders() { return { Authorization: "Bearer t2" }; } };
      },
    };
    const get = createIdTokenProvider(auth);
    await expect(get("a")).rejects.toThrow();
    expect(await get("a")).toBe("t2");
  });

  it("rejects a response without a bearer token", async () => {
    const get = createIdTokenProvider({ getIdTokenClient: async () => ({ getRequestHeaders: async () => ({}) }) });
    await expect(get("a")).rejects.toThrow();
  });
});
