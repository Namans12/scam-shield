/** Shared low-level helpers/patterns used by extract.ts and redact.ts. */

/** Convert Devanagari digits (U+0966-U+096F) to ASCII digits. Length-preserving. */
export function toAsciiDigits(text: string): string {
  return text.replace(/[०-९]/g, (c) => String(c.charCodeAt(0) - 0x0966));
}

/** Luhn checksum over a string of ASCII digits. */
export function luhnValid(digits: string): boolean {
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return digits.length > 0 && sum % 10 === 0;
}

/** 13-19 digit run, optionally grouped by single spaces/dashes. Caller must Luhn-check. */
export const CARD_RE = /(?<!\d)\d(?:[ -]?\d){12,18}(?!\d)/g;

/** Aadhaar-shaped 4-4-4 number with mandatory separators. */
export const AADHAAR_SEP_RE = /(?<!\d[ -]?)\d{4}[ -]\d{4}[ -]\d{4}(?![ -]?\d)/g;

/** Aadhaar-shaped 12-digit number, separators optional. */
export const AADHAAR_ANY_RE = /(?<!\d[ -]?)\d{4}[ -]?\d{4}[ -]?\d{4}(?![ -]?\d)/g;
