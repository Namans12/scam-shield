import type { EntityHit, GeminiVerdict, HardSignal, QrInfo } from "@scam-shield/shared";

export interface HardSignalContext { hits: EntityHit[]; qr?: QrInfo; text?: string }

const RECEIVE_WORDS = /receive|refund|cashback|prize|reward|\bwon\b(?!['’]t)|credited|मिलेगा|मिलेंगे|प्राप्त|जीत|इनाम|कैशबैक|रिफंड|जमा|milega|milenge|jeet|inaam/i;

/**
 * Deterministic overrides applied after the model verdict. They can only raise
 * the verdict / risk score, never lower it, and never mutate the input.
 */
export function applyHardSignals(v: GeminiVerdict, ctx: HardSignalContext): { verdict: GeminiVerdict; hardSignals: HardSignal[] } {
  const hardSignals: HardSignal[] = [];
  let out: GeminiVerdict = v;

  const raise = (verdict: "suspicious" | "scam", minScore: number, scamType?: GeminiVerdict["scam_type"]) => {
    const rank = { no_signs: 0, suspicious: 1, scam: 2 } as const;
    out = {
      ...out,
      verdict: rank[verdict] > rank[out.verdict] ? verdict : out.verdict,
      risk_score: Math.max(out.risk_score, minScore),
      scam_type: scamType && (out.scam_type === "none" || out.scam_type === "other") ? scamType : out.scam_type,
    };
  };

  const maxReports = ctx.hits.reduce((m, h) => Math.max(m, h.reportCount), 0);
  if (maxReports >= 2) {
    hardSignals.push("multi_reported_entity");
    raise("scam", 85);
  } else if (maxReports === 1) {
    hardSignals.push("reported_entity");
    raise("suspicious", 60);
  }

  // A UPI "pay" QR presented as a way to receive money is always a scam: scanning it sends money out.
  // Deliberately independent of the payload's `am` (raw, possibly padded or malformed).
  if (ctx.qr?.upi && ctx.text && RECEIVE_WORDS.test(ctx.text)) {
    hardSignals.push("qr_pay_disguised_as_receive");
    raise("scam", 85, "qr_receive_scam");
  }

  return { verdict: out, hardSignals };
}
