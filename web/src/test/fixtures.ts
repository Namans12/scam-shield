import type { CheckResult } from "@scam-shield/shared";

export const JPEG_DATA_URL = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

export function makeResult(overrides: Partial<CheckResult> = {}): CheckResult {
  return {
    id: "chk_123",
    createdAt: "2026-10-16T10:00:00.000Z",
    inputKind: "text",
    verdict: "scam",
    risk_score: 92,
    scam_type: "kyc_update",
    summary: "This message pretends to be your bank and pushes you to update KYC through a link.",
    red_flags: [
      {
        flag: "Urgent threat to block your account",
        evidence: "Your account will be blocked today",
        why_it_matters: "Real banks do not threaten you with same-day blocking over SMS.",
      },
      {
        flag: "Link that is not the bank's website",
        evidence: "http://bnb-kyc-update.example/login",
        why_it_matters: "The address does not belong to the bank.",
      },
    ],
    next_steps: ["Do not tap the link.", "Call your bank on the number printed on your card."],
    entities: { phones: [], upi_ids: [], urls: ["http://bnb-kyc-update.example/login"], bank_accounts: [], brands_impersonated: ["Bharat National Bank"] },
    language: "en",
    entityKeys: ["phone:+919876543210", "domain:bnb-kyc-update.example"],
    hits: [
      {
        key: "phone:+919876543210",
        reportCount: 7,
        scamTypes: ["kyc_update"],
        linked: ["upi:ravi.kumar@okbnb"],
        lastSeen: "2026-10-15T08:00:00.000Z",
      },
    ],
    hardSignals: ["multi_reported_entity"],
    latencyMs: 4200,
    ...overrides,
  };
}
