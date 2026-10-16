import { z } from "zod";

export type Lang = "en" | "hi";
export type Verdict = "scam" | "suspicious" | "no_signs";
export const SCAM_TYPES = ["kyc_update", "fake_payment", "qr_receive_scam", "digital_arrest", "job_task", "investment", "loan_app", "lottery_prize", "delivery_customs", "impersonation_bank", "phishing_link", "sextortion", "other", "none"] as const;
export type ScamType = (typeof SCAM_TYPES)[number];
export type EntityType = "phone" | "upi" | "domain" | "acct";
export type EntityKey = `${EntityType}:${string}`;

export interface RedFlag { flag: string; evidence: string; why_it_matters: string }
export interface GeminiVerdict {
  verdict: Verdict; risk_score: number; scam_type: ScamType; summary: string;
  red_flags: RedFlag[]; next_steps: string[];
  entities: { phones: string[]; upi_ids: string[]; urls: string[]; bank_accounts: string[]; brands_impersonated: string[] };
  language: Lang; transcript?: string;
}

const redFlagSchema = z.object({
  flag: z.string(),
  evidence: z.string(),
  why_it_matters: z.string(),
});

const entitiesSchema = z.object({
  phones: z.array(z.string()).default([]),
  upi_ids: z.array(z.string()).default([]),
  urls: z.array(z.string()).default([]),
  bank_accounts: z.array(z.string()).default([]),
  brands_impersonated: z.array(z.string()).default([]),
});

export const geminiVerdictSchema: z.ZodType<GeminiVerdict> = z.object({
  verdict: z.enum(["scam", "suspicious", "no_signs"]),
  risk_score: z.number().int().min(0).max(100),
  scam_type: z.enum(SCAM_TYPES),
  summary: z.string(),
  red_flags: z.array(redFlagSchema).default([]),
  next_steps: z.array(z.string()).default([]),
  entities: entitiesSchema.default({ phones: [], upi_ids: [], urls: [], bank_accounts: [], brands_impersonated: [] }),
  language: z.enum(["en", "hi"]),
  transcript: z.string().optional(),
});

export const GEMINI_RESPONSE_JSON_SCHEMA: object = z.toJSONSchema(geminiVerdictSchema);

export interface UpiPayload { pa: string; pn?: string; am?: string; tn?: string }
export interface QrInfo { raw: string; upi?: UpiPayload }
export interface LinkScan {
  requestedUrl: string; finalUrl?: string; redirects: string[]; title?: string; text?: string;
  screenshotDataUrl?: string; httpStatus?: number;
  blockedReason?: "bad_scheme" | "bad_port" | "private_address" | "unresolvable" | "timeout" | "scan_failed";
}
export interface EntityHit { key: EntityKey; reportCount: number; scamTypes: ScamType[]; linked: EntityKey[]; lastSeen: string }
export type HardSignal = "multi_reported_entity" | "reported_entity" | "qr_pay_disguised_as_receive";
export interface CheckRequest { text?: string; url?: string; storagePath?: string; mimeType?: string; lang: Lang; exampleId?: string }
export interface CheckResult extends GeminiVerdict {
  id: string; createdAt: string; inputKind: "text" | "image" | "audio" | "link";
  entityKeys: EntityKey[]; hits: EntityHit[]; hardSignals: HardSignal[];
  qr?: QrInfo; linkScan?: LinkScan; latencyMs: number;
}
