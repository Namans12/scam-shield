import { GoogleAuth } from "google-auth-library";
import type { LinkScan } from "@scam-shield/shared";

export interface LinkScanner { scan(url: string): Promise<LinkScan> }

export interface LinkScanClientDeps {
  fetch?: typeof fetch;
  /** Returns a Google-signed ID token whose audience is `baseUrl`. */
  getIdToken?: (audience: string) => Promise<string>;
}

const REASONS = new Set(["bad_scheme", "bad_port", "private_address", "unresolvable", "timeout", "scan_failed"]);

function failed(requestedUrl: string): LinkScan {
  return { requestedUrl, redirects: [], blockedReason: "scan_failed" };
}

const str = (v: unknown, max: number): string | undefined => (typeof v === "string" ? v.slice(0, max) : undefined);

/** Keeps only the known LinkScan fields with the right types; null when the body is not a scan result. */
function parseScan(body: unknown, requestedUrl: string): LinkScan | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  if (typeof b.requestedUrl !== "string" || !Array.isArray(b.redirects)) return null;
  const out: LinkScan = {
    requestedUrl: requestedUrl,
    redirects: b.redirects.filter((r): r is string => typeof r === "string").slice(0, 20).map((r) => r.slice(0, 2048)),
  };
  const finalUrl = str(b.finalUrl, 2048); if (finalUrl) out.finalUrl = finalUrl;
  const title = str(b.title, 500); if (title) out.title = title;
  const text = str(b.text, 20_000); if (text) out.text = text;
  if (typeof b.screenshotDataUrl === "string" && b.screenshotDataUrl.startsWith("data:image/jpeg;base64,") && b.screenshotDataUrl.length < 8_000_000) {
    out.screenshotDataUrl = b.screenshotDataUrl;
  }
  if (typeof b.httpStatus === "number") out.httpStatus = b.httpStatus;
  if (typeof b.blockedReason === "string" && REASONS.has(b.blockedReason)) out.blockedReason = b.blockedReason as LinkScan["blockedReason"];
  return out;
}

function googleIdToken(): (audience: string) => Promise<string> {
  const auth = new GoogleAuth();
  return async (audience) => {
    const client = await auth.getIdTokenClient(audience);
    return client.idTokenProvider.fetchIdToken(audience);
  };
}

/** Client for the private Cloud Run linkscan service. Never throws: any failure becomes `blockedReason: "scan_failed"`. */
export function createLinkScanClient(baseUrl: string, timeoutMs = 20_000, deps: LinkScanClientDeps = {}): LinkScanner {
  const doFetch = deps.fetch ?? fetch;
  const getIdToken = deps.getIdToken ?? googleIdToken();
  const endpoint = `${baseUrl.replace(/\/+$/, "")}/scan`;
  return {
    async scan(url) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const token = await getIdToken(baseUrl.replace(/\/+$/, ""));
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
      }
    },
  };
}
