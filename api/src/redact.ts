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
// Text allowed between a number and a following label: "482913 is OTP", "Use 482913 as your OTP".
const BETWEEN_NUM_AND_LABEL = /^\s*(?:(?:is|as|का|है)\s+)?(?:(?:your|the|an?|आपका|आपकी)\s+)?$/i;
const FORWARD_WINDOW = 25;
const BACKWARD_WINDOW = 25;

interface Edit { start: number; end: number; text: string }

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
    const digits = phone && phone.startsWith("+91") ? phone.slice(3) : v.replace(/\D/g, "");
    if (!digits) return null;
    return new RegExp(`(?<!\\d)${digits.split("").join("[ -]?")}(?!\\d)`, "g");
  }
  return new RegExp(esc(v), "gi");
}

/** Find a standalone digit run of the right length that is not an amount, grouped number or part of a code. */
function findSecret(window: string, minLen: number, maxLen: number, atLabelEnd: boolean): { start: number; end: number } | null {
  for (const m of window.matchAll(/\d+/g)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    const before = window.slice(0, start);
    const prev = window[start - 1] ?? "";
    const next = window[end] ?? "";
    if (CURRENCY_BEFORE.test(before)) continue; // an amount, keep looking
    if (/^[,.]\d/.test(window.slice(end, end + 2)) || (/[,.]/.test(prev) && /\d/.test(window[start - 2] ?? ""))) continue; // grouped/decimal amount
    if (/[A-Za-z]/.test(prev) && !(atLabelEnd && start === 0)) continue; // part of an alphanumeric code (IFSC etc.)
    if (/[A-Za-z]/.test(next)) continue;
    if (m[0].length < minLen || m[0].length > maxLen) return null; // some other number: stop
    return { start, end };
  }
  return null;
}

/**
 * Replace the victim's sensitive numbers (OTP/CVV, Aadhaar, PAN, Luhn-valid card numbers) with
 * placeholders before text leaves the API.
 *
 * `keep` lists scammer identifiers that must stay readable. Each entry may be a raw value
 * ("+917000011111", "123456789012", "ab@ybl") or an entity key ("phone:+917000011111"); phone and
 * digit values also match when written with spaces/dashes. Kept spans are masked before any
 * pattern runs, so no redaction can overlap or consume them.
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

  const edits: Edit[] = [];
  const free = (s: number, e: number) => !edits.some((x) => s < x.end && e > x.start);
  const add = (start: number, end: number, t: string) => {
    if (free(start, end)) edits.push({ start, end, text: t });
  };

  for (const m of masked.matchAll(CARD_RE)) {
    if (luhnValid(m[0].replace(/\D/g, ""))) add(m.index!, m.index! + m[0].length, "[card]");
  }
  for (const m of masked.matchAll(AADHAAR_ANY_RE)) add(m.index!, m.index! + m[0].length, "[aadhaar]");
  for (const m of masked.matchAll(PAN_RE)) add(m.index!, m.index! + m[0].length, "[pan]");

  for (const m of masked.matchAll(LABEL_RE)) {
    const labelStart = m.index!;
    const labelEnd = labelStart + m[0].length;
    const [minLen, maxLen] = CVV_LABEL_RE.test(m[0]) ? [3, 4] : [4, 8];
    const fwd = findSecret(masked.slice(labelEnd, labelEnd + FORWARD_WINDOW), minLen, maxLen, true);
    if (fwd) {
      add(labelEnd + fwd.start, labelEnd + fwd.end, "[otp]");
      continue;
    }
    // Number before the label: "482913 is OTP for ...", "Use 482913 as your OTP".
    const bwStart = Math.max(0, labelStart - BACKWARD_WINDOW);
    const bw = masked.slice(bwStart, labelStart);
    const runs = [...bw.matchAll(/\d+/g)];
    const last = runs[runs.length - 1];
    if (!last) continue;
    const s = last.index!;
    const e = s + last[0].length;
    const prev = bw[s - 1] ?? "";
    if (/[A-Za-z]/.test(prev) || CURRENCY_BEFORE.test(bw.slice(0, s)) || /^[,.]\d/.test(bw.slice(e, e + 2))) continue;
    if (last[0].length < minLen || last[0].length > maxLen) continue;
    if (!BETWEEN_NUM_AND_LABEL.test(bw.slice(e))) continue;
    add(bwStart + s, bwStart + e, "[otp]");
  }

  edits.sort((a, b) => b.start - a.start);
  let out = src;
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return out;
}
