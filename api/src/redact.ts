import { normalizePhone } from "./extract";
import { AADHAAR_ANY_RE, CARD_RE, luhnValid, toAsciiDigits } from "./patterns";

const PAN_RE = /\b[A-Z]{5}\d{4}[A-Z]\b/gi;

// Words that introduce a secret. Latin labels must not sit inside a longer word.
const LABEL_SRC =
  "(?<![A-Za-z])(?:one[- ]?time[- ]?(?:password|pin|code)|verification[- ]?code|security[- ]?code|o\\.?t\\.?p|passcode|password|cvv2?|cvc2?|pin|code)(?![A-Za-z])" +
  "|ओ\\.?\\s?टी\\.?\\s?पी\\.?|वन\\s+टाइम\\s+पासवर्ड|पासवर्ड";
const LABEL_RE = new RegExp(LABEL_SRC, "giu");
const CVV_LABEL_RE = /^(?:cvv|cvc)/i;
const CURRENCY_BEFORE = /(?:rs\.?|inr|₹|rupees?)\s*$/i;
// How far either side of a label we look for secret-looking numbers. Bank SMSs put amounts,
// merchants and references between the label and the code, and the code may come first.
const WINDOW = 60;

/** Escape a string for use in a RegExp. */
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Strip an optional entity-key prefix such as "phone:" or "acct:". */
function stripKeyPrefix(k: string): string {
  return k.replace(/^(?:phone|upi|domain|acct):/i, "");
}

/** Regex locating a keep value anywhere in the text (digit values may be spaced/dashed). */
function keepRegex(raw: string): RegExp | null {
  const v = stripKeyPrefix(raw.trim());
  if (!v) return null;
  if (/^[+\d\s-]+$/.test(v)) {
    const phone = normalizePhone(v);
    const isMobile = !!phone && phone.startsWith("+91");
    const digits = isMobile ? phone.slice(3) : v.replace(/\D/g, "");
    if (!digits) return null;
    // A kept mobile is masked together with any +91 / 91 / 0 prefix so the leftover digits
    // (e.g. the 12-digit "919876543210") can never be mistaken for an Aadhaar number.
    const prefix = isMobile ? "(?:\\+\\s?91[ -]?|91[ -]?|0)?" : "";
    return new RegExp(`(?<!\\d)${prefix}${digits.split("").join("[ -]?")}(?!\\d)`, "g");
  }
  return new RegExp(esc(v), "gi");
}

/**
 * Replace the victim's sensitive numbers (OTP/CVV/PIN, Aadhaar, PAN, Luhn-valid card numbers) with
 * placeholders before text leaves the API.
 *
 * `keep` lists scammer identifiers that must stay readable. Each entry may be a raw value
 * ("+917000011111", "123456789012", "ab@ybl") or an entity key ("phone:+917000011111"); phone and
 * digit values also match when written with spaces/dashes. Kept spans are masked before any
 * pattern runs, so no redaction can overlap or consume them.
 *
 * OTP/CVV/PIN policy: this text is stored only as evidence, so over-redaction is safe and
 * under-redaction is the failure. For every label occurrence ("OTP", "CVV", "PIN", "code", ...) EVERY
 * secret-looking number within WINDOW characters on either side is redacted. Only clear currency
 * amounts (Rs/INR/rupee-sign prefix, comma/decimal-grouped), alphanumeric codes (IFSC, PAN),
 * kept spans and numbers outside the 4-8 digit range (3-4 for CVV/CVC) are left alone.
 */
export function redact(text: string, keep: string[]): string {
  const src = toAsciiDigits(text ?? "");
  if (!src) return src;

  // Mask kept spans (same length, '#') so patterns never see them.
  let masked = src;
  for (const k of keep) {
    const re = keepRegex(k);
    if (re) masked = masked.replace(re, (m) => "#".repeat(m.length));
  }

  const edits: { start: number; end: number; text: string }[] = [];
  const claimed = new Uint8Array(src.length);
  const add = (start: number, end: number, t: string) => {
    for (let i = start; i < end; i++) if (claimed[i]) return;
    claimed.fill(1, start, end);
    edits.push({ start, end, text: t });
  };

  for (const m of masked.matchAll(CARD_RE)) {
    if (luhnValid(m[0].replace(/\D/g, ""))) add(m.index!, m.index! + m[0].length, "[card]");
  }
  for (const m of masked.matchAll(AADHAAR_ANY_RE)) add(m.index!, m.index! + m[0].length, "[aadhaar]");
  for (const m of masked.matchAll(PAN_RE)) add(m.index!, m.index! + m[0].length, "[pan]");

  for (const label of masked.matchAll(LABEL_RE)) {
    const labelStart = label.index!;
    const labelEnd = labelStart + label[0].length;
    const [minLen, maxLen] = CVV_LABEL_RE.test(label[0]) ? [3, 4] : [4, 8];
    const from = Math.max(0, labelStart - WINDOW);
    const to = Math.min(masked.length, labelEnd + WINDOW);

    for (const m of masked.slice(from, to).matchAll(/\d+/g)) {
      const start = from + m.index!;
      const end = start + m[0].length;
      if (m[0].length < minLen || m[0].length > maxLen) continue;
      // Fragment of a longer run cut off by the window edge.
      if (/\d/.test(masked[start - 1] ?? "") || /\d/.test(masked[end] ?? "")) continue;
      const prev = masked[start - 1] ?? "";
      const next = masked[end] ?? "";
      // Part of an alphanumeric code (IFSC, PAN, order ids) unless glued directly to the label ("OTP482913").
      if (/[A-Za-z]/.test(prev) && start !== labelEnd) continue;
      if (/[A-Za-z]/.test(next) && end !== labelStart) continue;
      // Currency amounts: "Rs 5000", "INR 2,500", "450.00".
      if (CURRENCY_BEFORE.test(masked.slice(Math.max(0, start - 8), start))) continue;
      if (/^[,.]\d/.test(masked.slice(end, end + 2)) || (/[,.]/.test(prev) && /\d/.test(masked[start - 2] ?? ""))) continue;
      add(start, end, "[otp]");
    }
  }

  edits.sort((a, b) => b.start - a.start);
  let out = src;
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return out;
}
