import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeBrowser, scanUrl } from "./scan";

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
    else if (url === "/redir-file") { res.writeHead(302, { location: "file:///etc/passwd" }); res.end(); }
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

  it("uses a fresh context per scan", async () => {
    const a = await scanUrl(`${mainOrigin}/login`, { allowPrivateForTests: true });
    const b = await scanUrl(`${mainOrigin}/login`, { allowPrivateForTests: true });
    expect(a.title).toBe(b.title);
  }, 60_000);
});
