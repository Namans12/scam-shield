import http from "node:http";
import net, { type AddressInfo, type Socket } from "node:net";
import type { LinkScan } from "@scam-shield/shared";
import { BlockedUrlError } from "./guard";

type Reason = NonNullable<LinkScan["blockedReason"]>;

/**
 * Resolves + validates a target URL and returns the addresses the proxy may connect to.
 * Throws BlockedUrlError for anything that must not be reached.
 */
export type Authorize = (rawUrl: string) => Promise<string[]>;

export interface ScanProxy {
  port: number;
  /** Reasons for every connection the proxy refused (in order). */
  denied: Reason[];
  /** True once the per-scan byte budget has been exceeded (all connections are then torn down). */
  overLimit(): boolean;
  close(): Promise<void>;
}

const HOP_HEADERS = ["connection", "proxy-connection", "keep-alive", "proxy-authorization", "proxy-authenticate", "upgrade", "te"];
const IDLE_MS = 20_000;

/**
 * A tiny per-scan forward proxy that Chromium is forced through. It is the enforcement point that
 * Playwright route handlers cannot be: Playwright does not re-route HTTP redirect hops, whereas every
 * hop (and every subresource, HTTP or HTTPS CONNECT) needs a fresh connection through here. It also
 * pins DNS: the validated address list is what we connect to (no second, attacker-influenced lookup),
 * and it enforces a total byte budget.
 */
export async function startScanProxy(authorize: Authorize, maxBytes: number): Promise<ScanProxy> {
  const denied: Reason[] = [];
  const sockets = new Set<Socket>();
  let bytes = 0;
  let over = false;

  const track = (s: Socket) => { sockets.add(s); s.once("close", () => sockets.delete(s)); s.on("error", () => undefined); };
  const count = (n: number) => {
    bytes += n;
    if (!over && bytes > maxBytes) { over = true; for (const s of sockets) s.destroy(); }
  };
  const pinned = (addrs: string[]) =>
    ((_host: string, opts: { all?: boolean }, cb: (...a: unknown[]) => void) => {
      const rows = addrs.map((address) => ({ address, family: net.isIP(address) }));
      if (opts && opts.all) cb(null, rows);
      else cb(null, rows[0].address, rows[0].family);
    }) as unknown as net.LookupFunction;
  const deny = (e: unknown, ...toKill: Socket[]) => {
    denied.push(e instanceof BlockedUrlError ? e.reason : "scan_failed");
    // No response at all: the browser sees a failed load rather than a renderable error page.
    for (const s of toKill) s.destroy();
  };

  const server = http.createServer((req, res) => {
    track(req.socket);
    (async () => {
      let target: URL;
      try { target = new URL(req.url ?? ""); } catch { return deny(new BlockedUrlError("bad_scheme"), req.socket); }
      if (target.protocol !== "http:") return deny(new BlockedUrlError("bad_scheme"), req.socket);
      let addrs: string[];
      try { addrs = await authorize(target.href); } catch (e) { return deny(e, req.socket); }
      if (over) return req.socket.destroy();

      const headers = { ...req.headers };
      for (const h of HOP_HEADERS) delete headers[h];
      const out = http.request(
        {
          host: target.hostname.replace(/^\[|\]$/g, ""),
          port: target.port || 80,
          method: req.method,
          path: target.pathname + target.search,
          headers,
          agent: false,
          lookup: pinned(addrs),
          timeout: IDLE_MS,
        },
        (inRes) => {
          const h = { ...inRes.headers };
          for (const k of HOP_HEADERS) delete h[k];
          res.writeHead(inRes.statusCode ?? 502, h);
          inRes.on("data", (c: Buffer) => count(c.length));
          inRes.pipe(res);
        },
      );
      out.on("socket", track);
      out.on("timeout", () => out.destroy());
      out.on("error", () => req.socket.destroy());
      req.on("data", (c: Buffer) => count(c.length));
      req.pipe(out);
    })().catch(() => req.socket.destroy());
  });

  // HTTPS (and any other CONNECT): validate host:port, then splice the tunnel to the pinned address.
  server.on("connect", (req, clientSocket: Socket) => {
    track(clientSocket);
    (async () => {
      let addrs: string[];
      try { addrs = await authorize(`https://${req.url}/`); } catch (e) { return deny(e, clientSocket); }
      if (over) return clientSocket.destroy();
      const m = /^(\[[^\]]+\]|[^:]+):(\d+)$/.exec(req.url ?? "");
      if (!m) return deny(new BlockedUrlError("bad_scheme"), clientSocket);
      const upstream = net.connect({ host: m[1].replace(/^\[|\]$/g, ""), port: Number(m[2]), lookup: pinned(addrs) });
      track(upstream);
      upstream.setTimeout(IDLE_MS, () => upstream.destroy());
      upstream.once("connect", () => {
        clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        upstream.on("data", (c: Buffer) => count(c.length));
        clientSocket.on("data", (c: Buffer) => count(c.length));
        upstream.pipe(clientSocket);
        clientSocket.pipe(upstream);
      });
      upstream.once("error", () => clientSocket.destroy());
      upstream.once("close", () => clientSocket.destroy());
      clientSocket.once("close", () => upstream.destroy());
    })().catch(() => clientSocket.destroy());
  });
  server.on("clientError", (_e, s) => s.destroy());

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  return {
    port: (server.address() as AddressInfo).port,
    denied,
    overLimit: () => over,
    close: () =>
      new Promise<void>((resolve) => {
        for (const s of sockets) s.destroy();
        server.close(() => resolve());
        server.closeAllConnections?.();
      }),
  };
}
