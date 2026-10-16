import type { CheckResult, EntityKey, Lang } from "./types";

function valuesOf(check: CheckResult, type: string, extra: string[]): string[] {
  const out = new Set<string>();
  for (const k of check.entityKeys as EntityKey[]) {
    if (k.startsWith(type + ":")) out.add(k.slice(type.length + 1));
  }
  for (const v of extra) if (v) out.add(v);
  return [...out];
}

const TEXT = {
  en: {
    title: "Complaint regarding suspected online fraud",
    to: "To: The Officer-in-Charge, Cyber Crime Cell / National Cyber Crime Reporting Portal",
    intro: "Respectfully, I wish to report a suspected online fraud attempt and request that it be looked into.",
    summary: "Incident summary",
    ids: "Scammer identifiers",
    phone: "Phone numbers", upi: "UPI IDs", domain: "Websites / links", acct: "Bank accounts",
    amount: "Amount lost",
    when: "Date and time of incident",
    evidence: "Evidence",
    evidenceLines: ["Screenshot / message / recording of the suspicious communication (attached)", "Automated analysis of the communication (Scam Shield) noted: "],
    request: "Request for action",
    requestLines: [
      "Please register this complaint and investigate the identifiers listed above.",
      "Please block or freeze the listed accounts, UPI IDs and phone numbers, and the websites if found to be fraudulent.",
      "If any money was lost, please help me with recovery steps.",
    ],
    note: "I have also reported or will report this on the national cybercrime helpline 1930 and on cybercrime.gov.in.",
    thanks: "Thank you for your time and help.",
  },
  hi: {
    title: "संदिग्ध ऑनलाइन धोखाधड़ी की शिकायत",
    to: "सेवा में: प्रभारी अधिकारी, साइबर क्राइम सेल / राष्ट्रीय साइबर अपराध रिपोर्टिंग पोर्टल",
    intro: "सविनय निवेदन है कि मैं एक संदिग्ध ऑनलाइन धोखाधड़ी की शिकायत दर्ज कराना चाहता/चाहती हूँ। कृपया इसकी जाँच करें।",
    summary: "घटना का सारांश",
    ids: "संदिग्ध की पहचान संबंधी जानकारी",
    phone: "फ़ोन नंबर", upi: "UPI आईडी", domain: "वेबसाइट / लिंक", acct: "बैंक खाते",
    amount: "गँवाई गई राशि",
    when: "घटना की तारीख और समय",
    evidence: "सबूत",
    evidenceLines: ["संदिग्ध संदेश / स्क्रीनशॉट / रिकॉर्डिंग (संलग्न)", "संदेश का स्वचालित विश्लेषण (Scam Shield), जिसमें ये संकेत मिले: "],
    request: "कार्रवाई का अनुरोध",
    requestLines: [
      "कृपया इस शिकायत को दर्ज करें और ऊपर दी गई जानकारी की जाँच करें।",
      "कृपया ऊपर दिए गए खातों, UPI आईडी और फ़ोन नंबरों को, तथा वेबसाइट धोखाधड़ी वाली पाई जाने पर उसे भी, ब्लॉक या फ़्रीज़ करें।",
      "यदि पैसा गया है, तो कृपया उसे वापस पाने में मेरी सहायता करें।",
    ],
    note: "मैंने राष्ट्रीय साइबर अपराध हेल्पलाइन 1930 और cybercrime.gov.in पर भी शिकायत की है या करूँगा/करूँगी।",
    thanks: "आपके समय और सहयोग के लिए धन्यवाद।",
  },
} as const;

/** Builds a plain, polite complaint draft the user can copy to 1930 / cybercrime.gov.in. */
export function buildComplaint(check: CheckResult, extra: { amountLost?: string; incidentAt?: string; lang: Lang }): string {
  const t = TEXT[extra.lang];
  const lines: string[] = [t.title, "", t.to, "", t.intro, ""];

  lines.push(`1. ${t.summary}`, check.summary, "");

  lines.push(`2. ${t.ids}`);
  const groups: [string, string[]][] = [
    [t.phone, valuesOf(check, "phone", check.entities.phones)],
    [t.upi, valuesOf(check, "upi", check.entities.upi_ids)],
    [t.domain, valuesOf(check, "domain", check.entities.urls)],
    [t.acct, valuesOf(check, "acct", check.entities.bank_accounts)],
  ];
  for (const [label, vals] of groups) {
    if (vals.length) lines.push(`- ${label}: ${vals.join(", ")}`);
  }
  lines.push("");

  let n = 3;
  if (extra.amountLost) lines.push(`${n++}. ${t.amount}: ${extra.amountLost}`, "");
  if (extra.incidentAt) lines.push(`${n++}. ${t.when}: ${extra.incidentAt}`, "");

  lines.push(`${n++}. ${t.evidence}`);
  lines.push(`- ${t.evidenceLines[0]}`);
  const flags = check.red_flags.map((f) => f.flag).filter(Boolean);
  const typeLabel = check.scam_type !== "none" ? check.scam_type.replace(/_/g, " ") : "";
  const flagText = [typeLabel, ...flags].filter(Boolean).join("; ");
  if (flagText) lines.push(`- ${t.evidenceLines[1]}${flagText}`);
  lines.push("");

  lines.push(`${n++}. ${t.request}`);
  for (const r of t.requestLines) lines.push(`- ${r}`);
  lines.push("", t.note, "", t.thanks);

  return lines.join("\n");
}
