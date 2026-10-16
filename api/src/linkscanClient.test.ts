import { describe, expect, it } from "vitest";
import { createLinkScanClient } from "./linkscanClient";

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
});
