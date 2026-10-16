// Seeds the shared scam list and trend stats with fictional demo data so the examples show "Reported N times".
// Idempotent: re-running restores the seeded entities and never overwrites real (non-seeded) data.
// Usage: npx tsx scripts/seed.ts   (needs gcloud logged in; PROJECT overrides the project id)
import { execFileSync } from "node:child_process";
import { maskIdentifier } from "@scam-shield/shared";
import type { EntityKey, ScamType } from "@scam-shield/shared";
import { encodeDocId, RECENT_CAP, splitKey } from "../api/src/store";
import type { DailyStats, EntityDoc, RecentItem } from "../api/src/store";

const PROJECT = process.env.PROJECT ?? "project-91260b43-6705-4176-b71";

interface Group { scamType: ScamType; reports: number; keys: EntityKey[] }
// All fictional. Keys within a group are linked to each other, like a real multi-identifier report.
export const GROUPS: Group[] = [
  { scamType: "kyc_update", reports: 3, keys: ["phone:+917000011111", "domain:bnb-kyc-update.web.app"] },
  { scamType: "qr_receive_scam", reports: 2, keys: ["upi:bnbreward.cashback@ybl"] },
  { scamType: "digital_arrest", reports: 2, keys: ["phone:+917000022222", "upi:cbi.verify.desk@ybl"] },
];

/** Plausible small daily counts (7 days ending today), fixed so re-running gives the same trends. */
const DAILY: Array<{ total: number; byType: Record<string, number>; byState: Record<string, number> }> = [
  { total: 9, byType: { kyc_update: 3, digital_arrest: 2, job_task: 2, investment: 1, fake_payment: 1 }, byState: { Maharashtra: 3, Delhi: 2, Karnataka: 2, "Uttar Pradesh": 2 } },
  { total: 12, byType: { kyc_update: 4, digital_arrest: 3, qr_receive_scam: 2, lottery_prize: 2, loan_app: 1 }, byState: { Maharashtra: 4, Delhi: 3, "Tamil Nadu": 3, Gujarat: 2 } },
  { total: 7, byType: { kyc_update: 2, job_task: 2, delivery_customs: 2, phishing_link: 1 }, byState: { Karnataka: 3, Telangana: 2, Maharashtra: 2 } },
  { total: 14, byType: { digital_arrest: 5, kyc_update: 3, investment: 3, fake_payment: 2, sextortion: 1 }, byState: { Delhi: 5, Maharashtra: 4, "Uttar Pradesh": 3, Rajasthan: 2 } },
  { total: 10, byType: { kyc_update: 3, qr_receive_scam: 3, job_task: 2, loan_app: 2 }, byState: { Gujarat: 3, Maharashtra: 3, Karnataka: 2, "West Bengal": 2 } },
  { total: 11, byType: { digital_arrest: 4, kyc_update: 3, lottery_prize: 2, impersonation_bank: 2 }, byState: { Delhi: 4, "Tamil Nadu": 3, Maharashtra: 2, Kerala: 2 } },
  { total: 8, byType: { kyc_update: 3, digital_arrest: 2, qr_receive_scam: 2, fake_payment: 1 }, byState: { Maharashtra: 3, Delhi: 2, Karnataka: 2, Punjab: 1 } },
];

const istDay = (d: Date) => new Date(d.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);

function token(): string {
  return execFileSync("gcloud", ["auth", "print-access-token"], { encoding: "utf8" }).trim();
}

// Firestore REST with the gcloud login (the Admin SDK would need application-default credentials).
type FsValue = Record<string, unknown>;
function enc(v: unknown): FsValue {
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "number") return { integerValue: String(v) };
  if (typeof v === "boolean") return { booleanValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v as object).map(([k, x]) => [k, enc(x)])) } };
}
function dec(v: FsValue): unknown {
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("booleanValue" in v) return v.booleanValue;
  if ("arrayValue" in v) return ((v.arrayValue as { values?: FsValue[] }).values ?? []).map(dec);
  if ("mapValue" in v) return Object.fromEntries(Object.entries((v.mapValue as { fields?: Record<string, FsValue> }).fields ?? {}).map(([k, x]) => [k, dec(x)]));
  return null;
}
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const auth = () => ({ authorization: `Bearer ${token()}`, "content-type": "application/json" });
async function getDoc<T>(path: string): Promise<T | undefined> {
  const r = await fetch(`${BASE}/${path}`, { headers: auth() });
  if (r.status === 404) return undefined;
  if (!r.ok) throw new Error(`GET ${path}: ${r.status} ${await r.text()}`);
  return dec({ mapValue: { fields: ((await r.json()) as { fields?: Record<string, FsValue> }).fields ?? {} } }) as T;
}
async function setDoc(path: string, data: object): Promise<void> {
  const r = await fetch(`${BASE}/${path}`, { method: "PATCH", headers: auth(), body: JSON.stringify(enc(data).mapValue) });
  if (!r.ok) throw new Error(`PATCH ${path}: ${r.status} ${await r.text()}`);
}

async function main() {
  const now = new Date();
  const nowIso = now.toISOString();

  // 1. Entities (overwrite only our own seeded docs; a doc without `seeded` is real data and is left alone).
  const recent: RecentItem[] = [];
  for (const g of GROUPS) {
    for (const key of g.keys) {
      const path = `entities/${encodeURIComponent(encodeDocId(key))}`;
      const cur = await getDoc<EntityDoc & { seeded?: boolean }>(path);
      if (cur && !cur.seeded) { console.log("skip (real data)", key); continue; }
      const { type, value } = splitKey(key);
      const doc: EntityDoc = {
        type, value, reportCount: g.reports, scamTypes: [g.scamType],
        linked: g.keys.filter((k) => k !== key), firstSeen: cur?.firstSeen ?? nowIso, lastSeen: cur?.lastSeen ?? nowIso, seeded: true,
      };
      await setDoc(path, doc);
      recent.push({ masked: maskIdentifier(key), type, scamType: g.scamType, reportCount: g.reports, lastSeen: doc.lastSeen });
      console.log("seeded", key, "x" + g.reports);
    }
  }

  // 2. Daily stats: create only the days that do not exist yet.
  for (let i = 0; i < DAILY.length; i++) {
    const day = istDay(new Date(now.getTime() - (DAILY.length - 1 - i) * 86_400_000));
    const path = `stats/daily-${day}`;
    if (await getDoc(path)) { console.log("skip stats", day); continue; }
    await setDoc(path, { ...(DAILY[i] as DailyStats), seeded: true });
    console.log("seeded stats", day);
  }

  // 3. Recent list: only when nothing real is there yet.
  const cur0 = await getDoc<{ items?: RecentItem[]; seeded?: boolean }>("stats/recent");
  if (!cur0 || cur0.seeded) {
    await setDoc("stats/recent", { items: recent.slice(0, RECENT_CAP), seeded: true });
    console.log("seeded stats/recent");
  } else console.log("skip stats/recent (real data)");
}

main().catch((e) => { console.error(e); process.exit(1); });
