import http from "node:http";
import net, { type AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { BlockedUrlError } from "./guard";
import { startScanProxy, type ScanProxy } from "./proxy";

const closers: Array<() => Promise<void> | void> = [];
afterEach(async () => { while (closers.length) await closers.pop()!(); });

async function upstream(handler: http.RequestListener) {
  const s = http.createServer(handler);
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
  closers.push(() => { s.closeAllConnections(); s.close(); });
  return (s.address() as AddressInfo).port;
}
async function proxyOf(authorize: (u: string) => Promise<string[]>, max = 1e9): Promise<ScanProxy> {
  const p = await startScanProxy(authorize, max);
  closers.push(() => p.close());
  return p;
}
const viaProxy = (proxyPort: number, absoluteUrl: string) =>
  new Promise<{ status?: number; body: string; error?: string }>((resolve) => {
    const req = http.request({ host: "127.0.0.1", port: proxyPort, method: "GET", path: absoluteUrl, headers: { host: new URL(absoluteUrl).host }, agent: false }, (res) => {
      let body = ""; res.on("data", (c) => (body += c)); res.on("end", () => resolve({ status: res.statusCode, body }));
    });
    req.on("error", (e) => resolve({ body: "", error: e.message }));
    req.end();
  });

describe("scan proxy", () => {
  it("connects to the validated (pinned) address, never re-resolving the hostname", async () => {
    const port = await upstream((_q, r) => r.end("pinned-ok"));
    const seen: string[] = [];
    const p = await proxyOf(async (u) => { seen.push(u); return ["127.0.0.1"]; });
    // "pinned.invalid" cannot resolve through real DNS; success proves the pinned address was used
    const res = await viaProxy(p.port, `http://pinned.invalid:${port}/x`);
    expect(res).toMatchObject({ status: 200, body: "pinned-ok" });
    expect(seen).toEqual([`http://pinned.invalid:${port}/x`]);
  });

  it("drops the connection (no renderable response) and records the reason when authorize refuses", async () => {
    const port = await upstream((_q, r) => r.end("should-not-be-reached"));
    const p = await proxyOf(async () => { throw new BlockedUrlError("private_address"); });
    const res = await viaProxy(p.port, `http://127.0.0.1:${port}/`);
    expect(res.status).toBeUndefined();
    expect(res.error).toBeDefined();
    expect(p.denied).toEqual(["private_address"]);
    expect(p.deniedDetail).toEqual([{ reason: "private_address", url: `http://127.0.0.1:${port}/` }]);
  });

  it("refuses CONNECT tunnels to blocked targets and passes the right host:port to authorize", async () => {
    const seen: string[] = [];
    const p = await proxyOf(async (u) => { seen.push(u); throw new BlockedUrlError("private_address"); });
    const out = await new Promise<string>((resolve) => {
      const s = net.connect(p.port, "127.0.0.1", () => s.write("CONNECT 169.254.169.254:443 HTTP/1.1\r\nHost: 169.254.169.254:443\r\n\r\n"));
      let data = ""; s.on("data", (c) => (data += c)); s.on("close", () => resolve(data)); s.on("error", () => resolve(data));
    });
    expect(out).not.toContain("200");
    expect(seen).toEqual(["https://169.254.169.254:443/"]);
    expect(p.denied).toEqual(["private_address"]);
  });

  it("tears connections down once the byte budget is exceeded", async () => {
    const port = await upstream((_q, r) => { r.write("x".repeat(100_000)); setTimeout(() => r.end("y".repeat(100_000)), 50); });
    const p = await proxyOf(async () => ["127.0.0.1"], 50_000);
    const res = await viaProxy(p.port, `http://pinned.invalid:${port}/big`);
    expect(p.overLimit()).toBe(true);
    expect(res.body.length).toBeLessThan(200_000);
  });
});
