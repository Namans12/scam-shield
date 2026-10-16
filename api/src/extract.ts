import { parse, getHostname } from "tldts";
import type { EntityKey } from "@scam-shield/shared";
import { AADHAAR_SEP_RE, CARD_RE, luhnValid, toAsciiDigits } from "./patterns";

export { luhnValid, toAsciiDigits };

export interface ExtractedEntities {
  phones: string[];
  upiIds: string[];
  urls: string[];
  domains: string[];
  bankAccounts: string[];
}

/** Indian mobile -> "+91XXXXXXXXXX"; 1800/1860 toll-free -> digits only; otherwise null. */
export function normalizePhone(raw: string): string | null {
  const digits = toAsciiDigits(raw).replace(/\D/g, "");
  if (/^1(?:800|860)\d{6,7}$/.test(digits)) return digits;
  let local: string | null = null;
  if (digits.length === 10) local = digits;
  else if (digits.length === 11 && digits.startsWith("0")) local = digits.slice(1);
  else if (digits.length === 12 && digits.startsWith("91")) local = digits.slice(2);
  if (local && /^[6-9]\d{9}$/.test(local)) return `+91${local}`;
  return null;
}

const blank = (s: string) => " ".repeat(s.length);
const TRAILING_PUNCT = /[.,;:!?)\]}'"]+$/;

const URL_RE = /\bhttps?:\/\/[^\s<>"'`()[\]{}]+/gi;
const UPI_RE = /(?<![\w.\-@])[\w.\-]{2,256}@[a-zA-Z]{2,64}(?!\w|\.\w)/g;
// Anchored at a token start so a long '@'-free token is scanned once, not once per character.
const AT_TOKEN_RE = /(?<!\S)\S*@\S*/g;
const PHONE_RE = /(?<![\w@])(?:\+\s?91[\s-]?|91[\s-]|0)?[6-9](?:[\s-]?\d){9}(?![\w@])|(?<![\w@])1(?:800|860)(?:[\s-]?\d){6,7}(?![\w@])/g;
const ACCT_RE = /(?<!\d)\d{9,18}(?!\d)/g;
const ACCT_CTX = /a\/c|account|acct|a\.c|खाता/i;
const AADHAAR_CTX = /\b(?:aadhaa?r|uid)\b|आधार/i;
const NOT_ACCT_CTX = /(?:utr|ref|txn|rrn|transaction|order|trans)\W{0,4}(?:no|id|number)?\W{0,4}$/i;
const BARE_DOMAIN_RE = /(?<![\w@.\-/])(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}(?![\w@-])(?:\/[^\s<>"'`]*)?/gi;

function hasPublicSuffix(host: string): boolean {
  const p = parse(host);
  return !!p.domain && !!p.publicSuffix && (p.isIcann === true || p.isPrivate === true) && !p.isIp;
}

function uniq(xs: string[]): string[] {
  return [...new Set(xs)];
}

export function extractEntities(input: string): ExtractedEntities {
  let text = toAsciiDigits(input ?? "");
  const phones: string[] = [];
  const upiIds: string[] = [];
  const urls: string[] = [];
  const domains: string[] = [];
  const bankAccounts: string[] = [];

  // 1. Explicit URLs (blanked afterwards so nothing inside is re-matched).
  text = text.replace(URL_RE, (m) => {
    const url = m.replace(TRAILING_PUNCT, "");
    const host = getHostname(url);
    if (host) {
      urls.push(url);
      domains.push(host.toLowerCase().replace(/\.$/, ""));
    }
    return blank(m);
  });

  // 2. UPI ids, then any remaining token with '@' (emails) so their dotted
  //    parts are never mistaken for bare domains (e.g. "refund.sbi").
  text = text.replace(UPI_RE, (m) => {
    upiIds.push(m.toLowerCase());
    return blank(m);
  });
  text = text.replace(AT_TOKEN_RE, blank);

  // 3. Phones.
  text = text.replace(PHONE_RE, (m) => {
    // A bare 12-digit run (no '+', no separators) is an Aadhaar/UTR-like number, not a phone.
    if (/^\d{12}$/.test(m)) return m;
    const n = normalizePhone(m);
    if (!n) return m;
    phones.push(n);
    return blank(m);
  });

  // 4. Cards (Luhn-valid) and Aadhaar-shaped numbers are never bank accounts.
  text = text.replace(CARD_RE, (m) => (luhnValid(m.replace(/\D/g, "")) ? blank(m) : m));
  text = text.replace(AADHAAR_SEP_RE, blank);

  // 5. Bank accounts: 9-18 digit runs near an account keyword.
  for (const m of text.matchAll(ACCT_RE)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    const before = text.slice(Math.max(0, start - 30), start);
    const after = text.slice(end, end + 30);
    if (!ACCT_CTX.test(before) && !ACCT_CTX.test(after)) continue;
    if (m[0].length === 12 && AADHAAR_CTX.test(text.slice(Math.max(0, start - 20), start))) continue;
    if (NOT_ACCT_CTX.test(text.slice(Math.max(0, start - 14), start))) continue;
    bankAccounts.push(m[0]);
  }

  // 6. Bare domains with a real public suffix.
  for (const m of text.matchAll(BARE_DOMAIN_RE)) {
    const raw = m[0].replace(TRAILING_PUNCT, "");
    const host = getHostname(raw);
    if (!host) continue;
    const h = host.toLowerCase().replace(/\.$/, "");
    if (!hasPublicSuffix(h)) continue;
    urls.push(raw);
    domains.push(h);
  }

  return {
    phones: uniq(phones),
    upiIds: uniq(upiIds),
    urls: uniq(urls),
    domains: uniq(domains),
    bankAccounts: uniq(bankAccounts),
  };
}

/** Order is part of the contract: phones, upi, domains, accounts. */
export function toEntityKeys(e: ExtractedEntities): EntityKey[] {
  return [
    ...e.phones.map((p) => `phone:${p}` as const),
    ...e.upiIds.map((u) => `upi:${u}` as const),
    ...e.domains.map((d) => `domain:${d}` as const),
    ...e.bankAccounts.map((a) => `acct:${a}` as const),
  ];
}
