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
    attachedImage: "Screenshot of the suspicious message (attached)",
    attachedAudio: "Recording of the suspicious call or voice message (attached)",
    onRequest: "I can provide the original message or link on request.",
    quoted: "Text quoted from the communication: ",
    analysis: "Automated analysis (Scam Shield) noted these warning signs: ",
    kind: {
      text: "I received a suspicious message.",
      image: "I received a suspicious message and have a screenshot of it.",
      audio: "I received a suspicious call or voice message and have a recording of it.",
      link: "I received a suspicious link.",
    },
    impersonates: "It appears to impersonate: ",
    types: {
      kyc_update: "KYC update scam",
      fake_payment: "fake payment",
      qr_receive_scam: "QR code \"receive money\" trick",
      digital_arrest: "\"digital arrest\" threat",
      job_task: "fake job or task scam",
      investment: "investment scam",
      loan_app: "loan app scam",
      lottery_prize: "lottery or prize scam",
      delivery_customs: "fake delivery or customs fee",
      impersonation_bank: "bank impersonation",
      phishing_link: "phishing link",
      sextortion: "sextortion",
      other: "suspected fraud",
      none: "",
    },
    describe: {
      kyc_update: "It appears to be a fraudulent KYC update scam designed to steal the recipient's personal and financial details.",
      fake_payment: "It appears to be a fake payment claim designed to make the recipient hand over goods, services or money.",
      qr_receive_scam: "It appears to be a QR code scam that makes the recipient approve a payment while believing they are receiving money.",
      digital_arrest: "It appears to be a \"digital arrest\" scam that threatens the recipient with arrest in order to extract money.",
      job_task: "It appears to be a fake job or task scam that asks the recipient to pay or deposit money.",
      investment: "It appears to be a fraudulent investment scheme designed to take money from the recipient.",
      loan_app: "It appears to be a loan app scam that uses harassment or hidden charges to extract money.",
      lottery_prize: "It appears to be a lottery or prize scam that asks the recipient to pay a fee to claim a reward.",
      delivery_customs: "It appears to be a fake delivery or customs fee scam designed to collect payment or card details.",
      impersonation_bank: "It appears to be an attempt to pass off as a bank in order to obtain the recipient's account details, OTP or money.",
      phishing_link: "It appears to be a phishing link designed to steal the recipient's login, card or personal details.",
      sextortion: "It appears to be a sextortion attempt that threatens to share private images in order to demand money.",
      other: "It appears to be an attempt to defraud the recipient.",
      none: "It may be an attempt to defraud the recipient, so I am reporting it for review.",
    },
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
    attachedImage: "संदिग्ध संदेश का स्क्रीनशॉट (संलग्न)",
    attachedAudio: "संदिग्ध कॉल या वॉइस संदेश की रिकॉर्डिंग (संलग्न)",
    onRequest: "ज़रूरत पड़ने पर मैं मूल संदेश या लिंक उपलब्ध करा सकता/सकती हूँ।",
    quoted: "संदेश से लिया गया अंश: ",
    analysis: "स्वचालित विश्लेषण (Scam Shield) में चेतावनी के ये संकेत मिले: ",
    kind: {
      text: "मुझे एक संदिग्ध संदेश मिला।",
      image: "मुझे एक संदिग्ध संदेश मिला, जिसका स्क्रीनशॉट मेरे पास है।",
      audio: "मुझे एक संदिग्ध कॉल या वॉइस संदेश मिला, जिसकी रिकॉर्डिंग मेरे पास है।",
      link: "मुझे एक संदिग्ध लिंक मिला।",
    },
    impersonates: "ऐसा लगता है कि यह इनके नाम पर भेजा गया है: ",
    types: {
      kyc_update: "KYC अपडेट की धोखाधड़ी",
      fake_payment: "नकली पेमेंट",
      qr_receive_scam: "QR कोड से \"पैसे पाने\" की चाल",
      digital_arrest: "\"डिजिटल अरेस्ट\" की धमकी",
      job_task: "नकली नौकरी या टास्क",
      investment: "निवेश की धोखाधड़ी",
      loan_app: "लोन ऐप की धोखाधड़ी",
      lottery_prize: "लॉटरी या इनाम की धोखाधड़ी",
      delivery_customs: "नकली डिलीवरी या कस्टम्स शुल्क",
      impersonation_bank: "बैंक बनकर ठगी",
      phishing_link: "फ़िशिंग लिंक",
      sextortion: "ब्लैकमेल कर पैसे माँगना",
      other: "संदिग्ध धोखाधड़ी",
      none: "",
    },
    describe: {
      kyc_update: "यह KYC अपडेट के नाम पर की जा रही धोखाधड़ी प्रतीत होती है, जिसका मकसद प्राप्तकर्ता की निजी और वित्तीय जानकारी चुराना है।",
      fake_payment: "यह नकली पेमेंट का दावा प्रतीत होता है, जिससे प्राप्तकर्ता को सामान, सेवा या पैसे देने के लिए बहकाया जा रहा है।",
      qr_receive_scam: "यह QR कोड की धोखाधड़ी प्रतीत होती है, जिसमें प्राप्तकर्ता को पैसे मिलने का भ्रम देकर उससे भुगतान मंज़ूर करवाया जाता है।",
      digital_arrest: "यह \"डिजिटल अरेस्ट\" की धोखाधड़ी प्रतीत होती है, जिसमें गिरफ़्तारी की धमकी देकर पैसे ऐंठे जाते हैं।",
      job_task: "यह नकली नौकरी या टास्क की धोखाधड़ी प्रतीत होती है, जिसमें प्राप्तकर्ता से पैसे जमा करवाए जाते हैं।",
      investment: "यह निवेश के नाम पर की जा रही धोखाधड़ी प्रतीत होती है, जिसका मकसद प्राप्तकर्ता से पैसे लेना है।",
      loan_app: "यह लोन ऐप की धोखाधड़ी प्रतीत होती है, जिसमें परेशान करके या छिपे शुल्क लगाकर पैसे वसूले जाते हैं।",
      lottery_prize: "यह लॉटरी या इनाम की धोखाधड़ी प्रतीत होती है, जिसमें इनाम पाने के नाम पर शुल्क माँगा जाता है।",
      delivery_customs: "यह नकली डिलीवरी या कस्टम्स शुल्क की धोखाधड़ी प्रतीत होती है, जिसका मकसद भुगतान या कार्ड की जानकारी हासिल करना है।",
      impersonation_bank: "यह बैंक बनकर की जा रही ठगी प्रतीत होती है, जिसका मकसद प्राप्तकर्ता के खाते की जानकारी, OTP या पैसे हासिल करना है।",
      phishing_link: "यह फ़िशिंग लिंक प्रतीत होता है, जिसका मकसद प्राप्तकर्ता के लॉगिन, कार्ड या निजी विवरण चुराना है।",
      sextortion: "यह निजी फ़ोटो या वीडियो फैलाने की धमकी देकर पैसे माँगने का प्रयास प्रतीत होता है।",
      other: "यह प्राप्तकर्ता के साथ धोखाधड़ी का प्रयास प्रतीत होता है।",
      none: "यह धोखाधड़ी का प्रयास हो सकता है, इसलिए मैं इसे जाँच के लिए रिपोर्ट कर रहा/रही हूँ।",
    },
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
export function buildComplaint(
  check: CheckResult,
  /** `hasAttachment`: whether the person has a file (screenshot / recording) to attach; defaults to true for image and audio checks only. */
  extra: { amountLost?: string; incidentAt?: string; lang: Lang; hasAttachment?: boolean },
): string {
  const t = TEXT[extra.lang];
  const lines: string[] = [t.title, "", t.to, "", t.intro, ""];

  // First-person and factual: built from the scam type, not the on-screen summary (which is addressed to the person reading the result).
  const hasFile = extra.hasAttachment ?? (check.inputKind === "image" || check.inputKind === "audio");
  const kind = check.inputKind === "link" ? t.kind.link : hasFile && check.inputKind === "audio" ? t.kind.audio : hasFile ? t.kind.image : t.kind.text;
  const brands = check.entities.brands_impersonated.filter(Boolean);
  lines.push(`1. ${t.summary}`, `${kind} ${t.describe[check.scam_type] ?? t.describe.other}`);
  if (brands.length) lines.push(`${t.impersonates}${brands.join(", ")}.`);
  lines.push("");

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
  if (hasFile) lines.push(`- ${check.inputKind === "audio" ? t.attachedAudio : t.attachedImage}`);
  else lines.push(`- ${t.onRequest}`);
  const quotes = check.red_flags.map((f) => f.evidence?.trim()).filter((e): e is string => !!e).slice(0, 3);
  for (const q of quotes) lines.push(`- ${t.quoted}"${q.length > 200 ? q.slice(0, 197) + "..." : q}"`);
  const flags = check.red_flags.map((f) => f.flag).filter(Boolean);
  const flagText = [t.types[check.scam_type] ?? "", ...flags].filter(Boolean).join("; ");
  if (flagText) lines.push(`- ${t.analysis}${flagText}`);
  lines.push("");

  lines.push(`${n++}. ${t.request}`);
  for (const r of t.requestLines) lines.push(`- ${r}`);
  lines.push("", t.note, "", t.thanks);

  return lines.join("\n");
}
