// Offline keyword/regex baseline: what a competent rule-based filter, with no language model, can do on the same cases.
// No network. Text only; image and audio cases are "not applicable" (a keyword filter cannot read them).
// Rules were written from general knowledge of Indian scam patterns and tuned only on the v1 cases (cases.jsonl);
// they were frozen before the v2 cases were scored, and never adjusted after seeing Gemini's results.
// Usage: npx tsx eval/baseline.ts [cases.jsonl ...]   (prints per-case verdicts and metrics)
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Verdict } from "@scam-shield/shared";

export interface BaselineResult { verdict: Verdict; score: number; matched: string[] }

interface Rule { name: string; re: RegExp; weight: number }

// Phrases that tell the reader NOT to do the risky thing. Removed before matching so that
// "Do not share your OTP" (a genuine bank warning) does not trigger the OTP rule.
const NEGATED = [
  /\b(?:do not|don't|dont|never|should not|must not)\s+(?:\w+\s+){0,3}?(?:share|click|tell|give|send|reveal|disclose|ask)\b[^.!?\n]*/gi,
  /\b(?:never|nahi|nahin|kabhi nahi)\s+(?:\w+\s+){0,3}?(?:asks?|maangta|maangti|maangte)\b[^.!?\n]*/gi,
  /\b(?:kisi\s+ko\s+)?(?:otp|pin)\s+(?:kabhi\s+)?(?:share\s+)?(?:mat|na)\s+(?:karein|kare|batayein|bataiye|dein)\b[^.!?\n]*/gi,
  /\bbanks?\s+(?:never|do not)\s+ask[^.!?\n]*/gi,
  /\bbeware\b[^.!?\n]*/gi,
  /\bsavdhaan\b[^.!?\n]*/gi,
];

const RULES: Rule[] = [
  // Credential grabbing
  { name: "asks for OTP/PIN/CVV", re: /\b(?:share|send|tell|give|enter|reply with|provide|bata\w*|bhej\w*|batao|do)\b[^.!?\n]{0,50}\b(?:otp|upi pin|pin|cvv|password)\b|\b(?:otp|cvv|pin)\b[^.!?\n]{0,20}\b(?:bata\w*|bhej\w*)/i, weight: 3 },
  { name: "mentions OTP code/PIN", re: /\b(?:otp|cvv|upi pin)\b/i, weight: 1 },
  { name: "KYC / PAN / Aadhaar update", re: /\b(?:kyc|re-kyc|pan\b[^.!?\n]{0,15}aadhaar|aadhaar\b[^.!?\n]{0,15}pan|update\s+(?:your\s+)?(?:pan|aadhaar))\b/i, weight: 2 },
  // Threat / urgency
  { name: "account blocked/suspended", re: /\b(?:blocked|suspended|frozen|freeze|deactivat\w+|disconnected|band ho|block ho|banned|terminated|restricted|destroyed)\b/i, weight: 2 },
  { name: "urgency", re: /\b(?:urgent\w*|immediately|right now|asap|turant|abhi|today|tonight|within\s+\d+\s*(?:hours?|hrs?|minutes?|mins?)|expires?\b|last chance|limited seats|final notice|now or)\b/i, weight: 1 },
  { name: "secrecy", re: /\b(?:tell nobody|do not tell|don't tell|dont tell|keep (?:it )?secret|mat batana|mat bataiye|kisi ko mat|don't call|do not call|dont call)\b/i, weight: 2 },
  // Links
  { name: "risky TLD / free hosting", re: /https?:\/\/[^\s]*?\.(?:top|xyz|vip|win|click|link|icu|shop|live|buzz|cfd|sbs|web\.app|firebaseapp\.com)\b/i, weight: 3 },
  { name: "risky link text", re: /\b[a-z0-9-]+\s*(?:dot|\.)\s*(?:top|xyz|vip|win|click|icu)\b/i, weight: 2 },
  { name: "shortener / telegram / apk", re: /\b(?:bit\.ly|tinyurl\.com|t\.me\/|wa\.me\/|[^\s]+\.apk)\b/i, weight: 2 },
  { name: "hyphenated brand-style domain", re: /https?:\/\/[a-z0-9]+(?:-[a-z0-9]+)+\./i, weight: 1 },
  { name: "any link", re: /https?:\/\/|\bwww\./i, weight: 0.5 },
  // Money asks
  { name: "pay fee to claim/start", re: /\b(?:processing|registration|claim|task|refundable|customs|clearance|security|release)\s+(?:fee|duty|charges?|deposit)\b|\bpay\b[^.!?\n]{0,30}\b(?:fee|duty)\b|\bfee\s+(?:bhar|payable)/i, weight: 3 },
  { name: "send/return money urgently", re: /\b(?:send|transfer|return|bhej\w*|pay)\b[^.!?\n]{0,25}\b(?:rs\.?|inr|₹)\s?\d|\b(?:rs\.?|inr|₹)\s?[\d,]+[^.!?\n]{0,30}\b(?:by mistake|galti se|return|wapas)\b/i, weight: 1.5 },
  { name: "sent by mistake, please return", re: /\b(?:sent|transferred|credited)\b[^.!?\n]{0,40}\bby mistake\b|\bby mistake\b[^.!?\n]{0,60}\b(?:return|refund|wapas)\b|\bgalti se\b/i, weight: 3 },
  { name: "paid, screenshot, ship now", re: /\b(?:i have paid|payment (?:done|made|sent)|paid)\b[^.!?\n]{0,80}\b(?:screenshot|will (?:be )?credit\w*|bank will)\b|\bscreenshot\b[^.!?\n]{0,80}\b(?:ship|dispatch|send)\b/i, weight: 3 },
  { name: "gift cards / crypto", re: /\bgift cards?\b|\busdt\b|\bbitcoin\b|\bcrypto\b/i, weight: 2 },
  { name: "call/WhatsApp this number", re: /\b(?:call|whatsapp|contact|message)\b[^.!?\n]{0,25}\b(?:\+?91[\s-]?)?[6-9]\d{9}\b|\b[6-9]\d{9}\s*(?:pe|par)\s+(?:baat|call)/i, weight: 1.5 },
  { name: "mentions UPI id to pay", re: /\b(?:send|pay|transfer|bhej\w*)\b[^.!?\n]{0,60}\b[a-z0-9._-]+@(?:ybl|okicici|okaxis|oksbi|okhdfcbank|paytm|upi|apl|ibl)\b/i, weight: 2 },
  // Scam scripts
  { name: "lottery / prize", re: /\b(?:you (?:have )?won|lottery|lucky draw|congratulations|prize|kbc)\b/i, weight: 2 },
  { name: "digital arrest / officials", re: /\b(?:digital arrest|cyber police|cbi|customs officer|money laundering|narcotics|drugs|trai|safe account|rbi safe)\b/i, weight: 3 },
  { name: "video call + stay on", re: /\b(?:stay on|video call)\b/i, weight: 1 },
  { name: "UPI collect / QR to receive", re: /\b(?:collect request|scan\b[^.!?\n]{0,30}\b(?:qr|code)\b|qr code)\b[^.!?\n]{0,60}\b(?:receive|refund|cashback|accept|pin)\b|\benter your upi pin\b/i, weight: 3 },
  { name: "guaranteed returns", re: /\b(?:guaranteed|double (?:it|your)|\d{3,}%\s*returns?|insider|ipo allotment)\b/i, weight: 3 },
  { name: "easy earning job", re: /\b(?:earn|kamaiye|kamao)\b[^.!?\n]{0,30}\b(?:daily|per day|roz|per task)\b|\bwork from home\b|\bliking (?:youtube|videos)|\brate products\b|\bghar baithe\b/i, weight: 2 },
  { name: "instant loan, no documents", re: /\binstant loan\b|\bno documents?\b/i, weight: 2 },
  { name: "threatens to leak / sextortion", re: /\b(?:recorded your|private video|send it to all your contacts)\b/i, weight: 3 },
  { name: "new number family ploy", re: /\b(?:lost my phone|new number|hi mom|hi dad)\b/i, weight: 2 },
  { name: "parcel held / delivery failed", re: /\b(?:parcel|package|courier)\b[^.!?\n]{0,60}\b(?:held|seized|returned|failed|customs|incomplete address|pakda)\b/i, weight: 2 },
  { name: "bank fraud-department script", re: /\b(?:fraud department|fraud desk|transaction[^.!?\n]{0,20}pending|pending on your card|cancel (?:it|this transaction))\b/i, weight: 2 },
  { name: "bank brand + action link/number", re: /\b(?:sbi|hdfc|icici|axis|bnb|bharat national bank|yono|paytm|phonepe|airtel|amazon|flipkart|india post)\b[^\n]{0,120}\b(?:update|verify|claim|redeem|pay now|click)\b/i, weight: 1 },
];

/** A strong, multi-cue message is "scam"; one or two moderate cues is "suspicious"; otherwise "no_signs". */
export const SCAM_AT = 5;
export const SUSPICIOUS_AT = 3;

export function classify(text: string): BaselineResult {
  let t = text;
  for (const n of NEGATED) t = t.replace(n, " ");
  const matched: string[] = [];
  let score = 0;
  for (const r of RULES) {
    if (r.re.test(t)) { matched.push(r.name); score += r.weight; }
  }
  const verdict: Verdict = score >= SCAM_AT ? "scam" : score >= SUSPICIOUS_AT ? "suspicious" : "no_signs";
  return { verdict, score, matched };
}

// ---- CLI ----
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const here = dirname(fileURLToPath(import.meta.url));
  const files = process.argv.slice(2).length ? process.argv.slice(2) : ["cases.jsonl", "cases-v2.jsonl"];
  for (const f of files) {
    const cases = readFileSync(resolve(here, f), "utf8").trim().split("\n").map((l) => JSON.parse(l)) as Array<{ id: string; kind: string; label: string; text?: string }>;
    console.log(`\n# ${f}`);
    for (const c of cases) {
      if (c.kind !== "text" || !c.text) { console.log(`${c.id} ${c.label.padEnd(9)} n/a (${c.kind})`); continue; }
      const r = classify(c.text);
      console.log(`${c.id} ${c.label.padEnd(9)} ${r.verdict.padEnd(10)} score ${String(r.score).padEnd(4)} ${r.matched.join("; ")}`);
    }
  }
}
