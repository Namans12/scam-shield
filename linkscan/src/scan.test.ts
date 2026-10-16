import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { capRedirects, capUrl, closeBrowser, closeWithin, pickDenial, scanDebugCounters, scanUrl } from "./scan";

let main: http.Server;
let secret: http.Server;
let mainOrigin = "";
let secretOrigin = "";
const secretHits: string[] = [];

const listen = (s: http.Server) =>
  new Promise<number>((r) => s.listen(0, "127.0.0.1", () => r((s.address() as AddressInfo).port)));

beforeAll(async () => {
  secret = http.createServer((req, res) => {
    secretHits.push(req.url ?? "");
    res.setHeader("content-type", "text/html");
    res.end("<title>INTERNAL SECRET</title>secret body");
  });
  const secretPort = await listen(secret);
  secretOrigin = `http://127.0.0.1:${secretPort}`;

  main = http.createServer((req, res) => {
    const url = req.url ?? "/";
    if (url === "/start") { res.writeHead(302, { location: "/login" }); res.end(); }
    else if (url === "/login") {
      res.setHeader("content-type", "text/html");
      res.end("<html><head><title>BNB KYC</title></head><body><h1>Verify your identity</h1><p>Enter your seed phrase</p></body></html>");
    } else if (url === "/redir-literal") { res.writeHead(302, { location: `${secretOrigin}/secret-literal` }); res.end(); }
    else if (url === "/redir-localhost") { res.writeHead(302, { location: `http://localhost:${secretPort}/secret-localhost` }); res.end(); }
    else if (url === "/redir-name") { res.writeHead(302, { location: `http://sneaky.test/secret-name` }); res.end(); }
    else if (url === "/redir-metadata") { res.writeHead(302, { location: "http://169.254.169.254/latest/meta-data/" }); res.end(); }
    else if (url === "/redir-hex") { res.writeHead(302, { location: "http://0x7f.1:" + secretPort + "/secret-hex" }); res.end(); }
    else if (url === "/redir-chain") { res.writeHead(302, { location: "/redir-literal" }); res.end(); }
    else if (url === "/webrtc") {
      res.setHeader("content-type", "text/html");
      res.end(`<title>pending</title><script>
        var r = { rtc: typeof RTCPeerConnection, wrtc: typeof webkitRTCPeerConnection, dc: typeof RTCDataChannel, wt: typeof WebTransport, ctor: "none" };
        try { new RTCPeerConnection(); r.ctor = "created"; } catch (e) { r.ctor = "threw"; }
        document.title = JSON.stringify(r);
      </script>`);
    } else if (url === "/state-set") {
      res.setHeader("content-type", "text/html");
      res.end(`<title>x</title><script>
        document.cookie = "sess=abc123; path=/"; localStorage.setItem("k", "v1"); sessionStorage.setItem("s", "v2");
        document.title = "set:" + document.cookie + "|" + localStorage.getItem("k") + "|" + sessionStorage.getItem("s");
      </script>`);
    } else if (url === "/state-read") {
      res.setHeader("content-type", "text/html");
      res.end(`<title>x</title><script>
        document.title = "read:" + document.cookie + "|" + localStorage.getItem("k") + "|" + sessionStorage.getItem("s");
      </script>`);
    } else if (url === "/redir-file") { res.writeHead(302, { location: "file:///etc/passwd" }); res.end(); }
    else if (url === "/sub") {
      res.setHeader("content-type", "text/html");
      res.end(`<title>Subresources</title><img src="${secretOrigin}/sub-img"><script src="${secretOrigin}/sub-script.js"></script><iframe src="${secretOrigin}/sub-frame"></iframe><p>visible text</p>`);
    } else if (url === "/slow") { /* never responds */ }
    else if (url === "/download") {
      res.writeHead(200, { "content-type": "application/octet-stream", "content-disposition": "attachment; filename=x.bin" });
      res.end("binary");
    } else if (url === "/big") {
      res.setHeader("content-type", "text/html");
      res.end(`<title>Big</title><body>${"word ".repeat(20000)}</body>`);
    } else { res.statusCode = 404; res.setHeader("content-type", "text/html"); res.end("<title>nope</title>not found"); }
  });
  const mainPort = await listen(main);
  mainOrigin = `http://127.0.0.1:${mainPort}`;
});

afterAll(async () => {
  await closeBrowser();
  main?.close();
  secret?.close();
});

const dnsMap = async (host: string) => (host === "sneaky.test" ? ["10.0.0.5"] : ["8.8.8.8"]);

describe("scanUrl (allowPrivateForTests)", () => {
  it("follows a redirect, records the chain, extracts title/text and a JPEG screenshot", async () => {
    const res = await scanUrl(`${mainOrigin}/start`, { allowPrivateForTests: true });
    expect(res).toMatchObject({ title: "BNB KYC", redirects: [expect.stringContaining("/start")], httpStatus: 200 });
    expect(res.finalUrl).toContain("/login");
    expect(res.text).toContain("seed phrase");
    expect(res.blockedReason).toBeUndefined();
    expect(res.screenshotDataUrl).toMatch(/^data:image\/jpeg;base64,/);
  }, 60_000);

  it("caps page text at 8000 chars", async () => {
    const res = await scanUrl(`${mainOrigin}/big`, { allowPrivateForTests: true });
    expect(res.text!.length).toBeLessThanOrEqual(8000);
    expect(res.text!.length).toBeGreaterThan(1000);
  }, 60_000);

  it("returns blockedReason timeout when the page never answers", async () => {
    const t0 = Date.now();
    const res = await scanUrl(`${mainOrigin}/slow`, { allowPrivateForTests: true, timeoutMs: 2000 });
    expect(res.blockedReason).toBe("timeout");
    expect(Date.now() - t0).toBeLessThan(8000);
  }, 60_000);

  it("does not hang or throw on a download response", async () => {
    const res = await scanUrl(`${mainOrigin}/download`, { allowPrivateForTests: true, timeoutMs: 8000 });
    expect(res.requestedUrl).toContain("/download");
    expect(res.blockedReason).toBe("scan_failed");
  }, 60_000);
});

describe("scanUrl SSRF guard", () => {
  it("blocks loopback without allowPrivateForTests", async () => {
    expect((await scanUrl("http://127.0.0.1:1/")).blockedReason).toBe("private_address");
  });

  it("blocks scheme / port / spelling variants end to end", async () => {
    expect((await scanUrl("file:///etc/passwd")).blockedReason).toBe("bad_scheme");
    expect((await scanUrl("http://example.com:8080/")).blockedReason).toBe("bad_port");
    for (const u of ["http://2130706433/", "http://0x7f.1/", "http://017700000001/", "http://[::ffff:127.0.0.1]/", "http://169.254.169.254/", "http://metadata.google.internal/"]) {
      expect((await scanUrl(u)).blockedReason, u).toBe("private_address");
    }
    expect((await scanUrl("http://nx.test/", { lookup: async () => [] })).blockedReason).toBe("unresolvable");
  });

  it("blocks redirects (incl. chained, metadata IP, hex-spelled) from an allowed start page to loopback/private targets before any request is made", async () => {
    secretHits.length = 0;
    for (const p of ["/redir-literal", "/redir-localhost", "/redir-name", "/redir-metadata", "/redir-hex", "/redir-chain"]) {
      const res = await scanUrl(`${mainOrigin}${p}`, { testAllowedOrigins: [mainOrigin], lookup: dnsMap, timeoutMs: 10_000 });
      expect(res.blockedReason, p).toBe("private_address");
      expect(res.title, p).toBeUndefined();
      expect(res.text, p).toBeUndefined();
      expect(res.screenshotDataUrl, p).toBeUndefined();
    }
    expect(secretHits).toEqual([]);
  }, 90_000);

  it("never follows a redirect to file:", async () => {
    const res = await scanUrl(`${mainOrigin}/redir-file`, { testAllowedOrigins: [mainOrigin], lookup: dnsMap, timeoutMs: 10_000 });
    expect(res.blockedReason).toBeDefined();
    expect(res.text).toBeUndefined();
  }, 60_000);

  it("aborts blocked subresources and frames but still scans the page", async () => {
    secretHits.length = 0;
    const res = await scanUrl(`${mainOrigin}/sub`, { testAllowedOrigins: [mainOrigin], lookup: dnsMap });
    expect(res.title).toBe("Subresources");
    expect(res.text).toContain("visible text");
    expect(secretHits).toEqual([]);
  }, 60_000);

  it("gives each scan a fresh context: cookies/localStorage/sessionStorage do not carry over", async () => {
    const first = await scanUrl(`${mainOrigin}/state-set`, { allowPrivateForTests: true });
    expect(first.title).toBe("set:sess=abc123|v1|v2"); // the state really was written in scan 1
    const second = await scanUrl(`${mainOrigin}/state-read`, { allowPrivateForTests: true });
    expect(second.title).toBe("read:|null|null");
  }, 60_000);

  it("removes WebRTC / WebTransport so they cannot bypass the proxy", async () => {
    const res = await scanUrl(`${mainOrigin}/webrtc`, { allowPrivateForTests: true });
    const r = JSON.parse(res.title!);
    expect(r).toEqual({ rtc: "undefined", wrtc: "undefined", dc: "undefined", wt: "undefined", ctor: "threw" });
  }, 60_000);
});

describe("scan lifecycle", () => {
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const settled = async () => {
    for (let i = 0; i < 50; i++) {
      const c = scanDebugCounters();
      if (c.inFlight === 0 && c.openProxies === 0 && c.openContexts === 0) return c;
      await sleep(100);
    }
    return scanDebugCounters();
  };

  it("deadline firing during a slow DNS lookup returns timeout and never starts a proxy/context afterwards", async () => {
    const before = scanDebugCounters();
    const res = await scanUrl("http://slow-dns.test/", { timeoutMs: 400, lookup: async () => { await sleep(1500); return ["8.8.8.8"]; } });
    expect(res.blockedReason).toBe("timeout");
    await sleep(2000); // lookup has now resolved; run() must have bailed
    const c = await settled();
    expect(c).toMatchObject({ inFlight: 0, openProxies: 0, openContexts: 0 });
    expect(c.proxiesStarted).toBe(before.proxiesStarted);
    expect(c.contextsStarted).toBe(before.contextsStarted);
  }, 30_000);

  it("deadline firing mid-navigation closes the context and proxy and frees the slot", async () => {
    const res = await scanUrl(`${mainOrigin}/slow`, { allowPrivateForTests: true, timeoutMs: 1500 });
    expect(res.blockedReason).toBe("timeout");
    expect(await settled()).toMatchObject({ inFlight: 0, openProxies: 0, openContexts: 0 });
  }, 30_000);

  it("rejects beyond MAX_CONCURRENT_SCANS with scan_failed", async () => {
    const prev = process.env.MAX_CONCURRENT_SCANS;
    process.env.MAX_CONCURRENT_SCANS = "1";
    try {
      const slow = scanUrl("http://hold.test/", { timeoutMs: 1500, lookup: async () => { await sleep(1000); return ["8.8.8.8"]; } });
      const second = await scanUrl("http://other.test/", { lookup: async () => ["8.8.8.8"] });
      expect(second).toMatchObject({ blockedReason: "scan_failed", redirects: [] });
      await slow;
    } finally {
      if (prev === undefined) delete process.env.MAX_CONCURRENT_SCANS; else process.env.MAX_CONCURRENT_SCANS = prev;
    }
    await settled();
  }, 30_000);
});

describe("closeWithin", () => {
  it("returns false when the close never settles, true when it finishes or throws", async () => {
    expect(await closeWithin(() => new Promise(() => undefined), 50)).toBe(false);
    expect(await closeWithin(async () => undefined, 50)).toBe(true);
    expect(await closeWithin(async () => { throw new Error("boom"); }, 50)).toBe(true);
  });
});

describe("result shaping", () => {
  it("caps URL length and redirect list", () => {
    expect(capUrl("http://a/" + "x".repeat(5000)).length).toBe(2048);
    const list = Array.from({ length: 50 }, (_, i) => "http://a/" + i + "x".repeat(3000));
    const out = capRedirects(list);
    expect(out).toHaveLength(20);
    expect(out.every((u) => u.length <= 2048)).toBe(true);
  });

  it("prefers the denial that matches a main-frame navigation origin", () => {
    const denials = [
      { reason: "bad_port" as const, url: "http://ads.example.net:8080/pixel" },
      { reason: "private_address" as const, url: "http://169.254.169.254/latest" },
    ];
    expect(pickDenial(denials, new Set(["http://start.example/", "http://169.254.169.254/latest"]))).toBe("private_address");
    expect(pickDenial(denials, new Set(["http://other.example/"]))).toBe("bad_port"); // fallback: first denial
    expect(pickDenial([], new Set())).toBeUndefined();
    // CONNECT denials are recorded as https://host:port/
    expect(pickDenial([{ reason: "private_address", url: "https://10.0.0.1:443/" }], new Set(["https://10.0.0.1/x"]))).toBe("private_address");
  });
});
