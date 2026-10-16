import { promises as dns } from "node:dns";
import { isIP } from "node:net";
import ipaddr from "ipaddr.js";
import type { LinkScan } from "@scam-shield/shared";

export type LookupFn = (host: string) => Promise<string[]>;
export type BlockedReason = NonNullable<LinkScan["blockedReason"]>;

export class BlockedUrlError extends Error {
  reason: BlockedReason;
  constructor(reason: BlockedReason, message?: string) {
    super(message ?? reason);
    this.name = "BlockedUrlError";
    this.reason = reason;
  }
}

/**
 * True only for globally routable unicast addresses. Everything else (loopback, RFC1918, CGNAT,
 * link-local, ULA, multicast, reserved/documentation, broadcast, unspecified, NAT64/6to4/Teredo
 * wrappers, unparseable input) is rejected. IPv4-mapped IPv6 is judged by the embedded IPv4.
 */
export function isPublicAddress(ip: string): boolean {
  let addr: ipaddr.IPv4 | ipaddr.IPv6;
  try {
    addr = ipaddr.parse(ip.trim());
  } catch {
    return false;
  }
  if (addr.kind() === "ipv6") {
    const v6 = addr as ipaddr.IPv6;
    if (v6.isIPv4MappedAddress()) return v6.toIPv4Address().range() === "unicast";
    // Global unicast only (2000::/3): rejects ::/96 (IPv4-compatible), 64:ff9b:1::/48, ULA, link-local, etc.
    if ((v6.parts[0] & 0xe000) !== 0x2000) return false;
  }
  return addr.range() === "unicast";
}

const MAX_URL_LENGTH = 2048;
const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".localdomain", ".lan", ".home.arpa", ".intranet", ".corp"];

export const defaultLookup: LookupFn = async (host) => {
  const rows = await dns.lookup(host, { all: true, verbatim: true });
  return rows.map((r) => r.address);
};

function isReservedHostname(host: string): boolean {
  if (host === "localhost" || host === "metadata") return true;
  if (!host.includes(".")) return true; // single-label names resolve via search domains / hosts file
  return BLOCKED_SUFFIXES.some((s) => host.endsWith(s));
}

/**
 * Validates scheme, port and destination. The URL parser normalises decimal/octal/hex/short IPv4
 * spellings and IPv6 forms, so the checks below operate on the canonical host. For DNS names ALL
 * A/AAAA records must be public. Throws BlockedUrlError.
 */
export async function assertPublicUrl(raw: string, lookup: LookupFn = defaultLookup): Promise<URL> {
  return (await resolvePublicUrl(raw, lookup)).url;
}

/**
 * Same checks as assertPublicUrl, but also returns the validated addresses (IPv4 first) so the caller
 * can connect to exactly what was validated (DNS pinning).
 */
export async function resolvePublicUrl(raw: string, lookup: LookupFn = defaultLookup): Promise<{ url: URL; addresses: string[] }> {
  if (typeof raw !== "string" || raw.length > MAX_URL_LENGTH) throw new BlockedUrlError("bad_scheme", "invalid url");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BlockedUrlError("bad_scheme", "unparseable url");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new BlockedUrlError("bad_scheme");
  let host = url.hostname.toLowerCase();
  if (host.startsWith("[") && host.endsWith("]")) host = host.slice(1, -1);
  host = host.replace(/\.+$/, "");
  if (!host) throw new BlockedUrlError("bad_scheme", "empty host");

  // Network-free checks first: an obviously private destination is reported as such regardless of port.
  const literal = isIP(host) !== 0;
  if (literal && !isPublicAddress(host)) throw new BlockedUrlError("private_address");
  if (!literal && isReservedHostname(host)) throw new BlockedUrlError("private_address");
  if (url.port !== "" && url.port !== "80" && url.port !== "443") throw new BlockedUrlError("bad_port");
  if (literal) return { url, addresses: [host] };

  let addrs: string[];
  try {
    addrs = await lookup(host);
  } catch {
    throw new BlockedUrlError("unresolvable");
  }
  if (!Array.isArray(addrs) || addrs.length === 0) throw new BlockedUrlError("unresolvable");
  if (!addrs.every(isPublicAddress)) throw new BlockedUrlError("private_address");
  return { url, addresses: [...addrs.filter((a) => isIP(a) === 4), ...addrs.filter((a) => isIP(a) !== 4)] };
}
