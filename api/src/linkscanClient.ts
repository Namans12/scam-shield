import { GoogleAuth } from "google-auth-library";
import type { LinkScan } from "@scam-shield/shared";

export interface LinkScanner { scan(url: string, signal?: AbortSignal): Promise<LinkScan> }

export interface LinkScanClientDeps {
  fetch?: typeof fetch;
  /** Returns a Google-signed ID token whose audience is `baseUrl`. */
  getIdToken?: (audience: string) => Promise<string>;
}

const REASONS = new Set(["bad_scheme", "bad_port", "private_address", "unresolvable", "timeout", "scan_failed"]);

function failed(requestedUrl: string): LinkScan {
  return { requestedUrl, redirects: [], blockedReason: "scan_failed" };
}

const httpUrl = (v: unknown): string | undefined => (typeof v === "string" && v.length <= 2048 && /^https?:\/\//i.test(v) ? v : undefined);
const str = (v: unknown, max: number): string | undefined => (typeof v === "string" ? v.slice(0, max) : undefined);

/** Keeps only the known LinkScan fields with the right types; null when the body is not a scan result. */
function parseScan(body: unknown, requestedUrl: string): LinkScan | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  if (typeof b.requestedUrl !== "string" || !Array.isArray(b.redirects)) return null;
  const out: LinkScan = {
    requestedUrl: requestedUrl,
    redirects: b.redirects.map(httpUrl).filter((r): r is string => !!r).slice(0, 20),
  };
  const finalUrl = httpUrl(b.finalUrl); if (finalUrl) out.finalUrl = finalUrl;
  const title = str(b.title, 500); if (title) out.title = title;
  const text = str(b.text, 20_000); if (text) out.text = text;
  if (typeof b.screenshotDataUrl === "string" && b.screenshotDataUrl.startsWith("data:image/jpeg;base64,") && b.screenshotDataUrl.length < 8_000_000) {
    out.screenshotDataUrl = b.screenshotDataUrl;
  }
  if (typeof b.httpStatus === "number") out.httpStatus = b.httpStatus;
  if (typeof b.blockedReason === "string" && REASONS.has(b.blockedReason)) out.blockedReason = b.blockedReason as LinkScan["blockedReason"];
  return out;
}

export interface IdTokenAuth {
  getIdTokenClient(audience: string): Promise<{ getRequestHeaders(): Promise<Headers | Record<string, string>> }>;
}

/**
 * Returns a function yielding a Google-signed ID token for an audience. The IdTokenClient is created once per
 * audience and reused: it caches the token and refreshes it shortly before expiry, so scans do not fetch a new
 * token each time.
 */
export function createIdTokenProvider(auth: IdTokenAuth = new GoogleAuth() as unknown as IdTokenAuth): (audience: string) => Promise<string> {
  const clients = new Map<string, ReturnType<IdTokenAuth["getIdTokenClient"]>>();
  return async (audience) => {
    let pending = clients.get(audience);
    if (!pending) { pending = auth.getIdTokenClient(audience); clients.set(audience, pending); }
    let client: Awaited<typeof pending>;
    try { client = await pending; } catch (e) { clients.delete(audience); throw e; }
    const h = await client.getRequestHeaders();
    const value = h instanceof Headers ? h.get("authorization") : (h.Authorization ?? h.authorization);
    const m = /^Bearer\s+(\S+)$/i.exec(value ?? "");
    if (!m) throw new Error("no id token");
    return m[1];
  };
}

/** Client for the private Cloud Run linkscan service. Never throws: any failure becomes `blockedReason: "scan_failed"`. */
export function createLinkScanClient(baseUrl: string, timeoutMs = 20_000, deps: LinkScanClientDeps = {}): LinkScanner {
  const doFetch = deps.fetch ?? fetch;
  const getIdToken = deps.getIdToken ?? createIdTokenProvider();
  const endpoint = `${baseUrl.replace(/\/+$/, "")}/scan`;
  return {
    async scan(url, signal) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      const onAbort = () => ctrl.abort();
      if (signal?.aborted) ctrl.abort();
      else signal?.addEventListener("abort", onAbort, { once: true });
      try {
        if (ctrl.signal.aborted) return failed(url);
        const token = await getIdToken(baseUrl.replace(/\/+$/, ""));
        if (ctrl.signal.aborted) return failed(url);
        const res = await doFetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify({ url }),
          signal: ctrl.signal,
        });
        if (!res.ok) return failed(url);
        return parseScan(await res.json(), url) ?? failed(url);
      } catch {
        return failed(url);
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
      }
    },
  };
}
