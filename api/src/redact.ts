import { luhnValid, normalizePhone, toAsciiDigits } from "./extract";

const CARD_RE = /(?<!\d)\d(?:[ -]?\d){12,18}(?!\d)/g;
const AADHAAR_RE = /(?<!\d[ -]?)\d{4}[ -]?\d{4}[ -]?\d{4}(?![ -]?\d)/g;
const PAN_RE = /\b[A-Z]{5}\d{4}[A-Z]\b/g;
const OTP_BEFORE_RE = /\b(otp|one[- ]time[- ]?(?:password|pin|code)|verification code|passcode|code|cvv|pin)(\D{1,20}?)\d{4,8}(?!\d)/gi;
const OTP_AFTER_RE = /(?<!\d)\d{4,8}(?!\d)(?=\s+is\s+(?:your|the)\s+(?:otp|code|verification|one[- ]time))/gi;

function canon(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9@]/g, "");
}

/**
 * Replace the victim's sensitive numbers with placeholders before text leaves the API.
 * Anything matching an entry in `keep` (scammer identifiers we want to analyse) is left intact.
 */
export function redact(text: string, keep: string[]): string {
  const keepSet = new Set<string>();
  for (const k of keep) {
    keepSet.add(canon(k));
    const ph = normalizePhone(k);
    if (ph) {
      keepSet.add(canon(ph));
      keepSet.add(ph.slice(3));
    }
  }
  const kept = (m: string) => keepSet.has(canon(m));

  return toAsciiDigits(text ?? "")
    .replace(CARD_RE, (m) => (!kept(m) && luhnValid(m.replace(/\D/g, "")) ? "[card]" : m))
    .replace(AADHAAR_RE, (m) => (kept(m) ? m : "[aadhaar]"))
    .replace(PAN_RE, (m) => (kept(m) ? m : "[pan]"))
    .replace(OTP_BEFORE_RE, (m, label: string, sep: string) => (kept(m.slice(label.length + sep.length)) ? m : `${label}${sep}[otp]`))
    .replace(OTP_AFTER_RE, (m) => (kept(m) ? m : "[otp]"));
}
