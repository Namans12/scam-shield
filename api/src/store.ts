import { maskIdentifier } from "@scam-shield/shared";
import type { CheckResult, EntityHit, EntityKey, ScamType } from "@scam-shield/shared";
import { createHash, randomUUID } from "node:crypto";

export interface StoredCheck extends CheckResult { uid: string; redactedText?: string; storagePath?: string; screenshotPath?: string }
export interface ReportInput { uid: string; checkId: string; entityKeys: EntityKey[]; scamType: ScamType; state?: string; city?: string; day: string /* yyyy-mm-dd IST */ }
export interface Store {
  getHits(keys: EntityKey[]): Promise<EntityHit[]>;              // only keys with reportCount > 0
  saveCheck(c: StoredCheck): Promise<void>;
  getCheck(id: string): Promise<StoredCheck | null>;
  addReport(r: ReportInput): Promise<{ reportId: string; newlyCounted: EntityKey[] }>;
  /** Counts one check for `uid`. The global counter advances only while the uid's new count is <= perUidLimit (when given), so a user over their limit cannot burn the shared budget. */
  bumpUsage(uid: string, day: string, perUidLimit?: number): Promise<{ uidCount: number; globalCount: number }>;
}

// ---------------------------------------------------------------------------
// Document shapes (identical in memory and in Firestore). entities/* and
// reporters/* are SERVER-ONLY; the web UI reads only stats/daily-* and
// stats/recent, which carry masked identifiers and no reporter UIDs.
// ---------------------------------------------------------------------------

export interface EntityDoc {
  type: string; value: string; reportCount: number; scamTypes: ScamType[]; linked: EntityKey[];
  firstSeen: string; lastSeen: string; seeded?: boolean;
}
export interface RecentItem { masked: string; type: string; scamType: ScamType; reportCount: number; lastSeen: string }
export interface RecentDoc { items: RecentItem[] }
export interface DailyStats { total: number; byType: Record<string, number>; byState: Record<string, number> }

export const LINKED_CAP = 20;
export const RECENT_CAP = 10;
export const MAX_KEYS_PER_REPORT = 100;

/** Splits "type:value" at the first colon (values such as UPI ids never contain it, but be safe). */
export function splitKey(key: EntityKey): { type: string; value: string } {
  const i = key.indexOf(":");
  return i < 0 ? { type: "", value: key } : { type: key.slice(0, i), value: key.slice(i + 1) };
}

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/** Replaces lone surrogates (invalid UTF-8 for Firestore/protobuf, and a throw in encodeURIComponent). */
export function wellFormed(s: string): string {
  return s.replace(LONE_SURROGATE, "�");
}

/** Firestore doc ids may not contain "/" and are limited to 1500 bytes. Escapes `/`, `%`, etc. reversibly. */
export function encodeDocId(s: string): string {
  const safe = wellFormed(s);
  const enc = encodeURIComponent(safe);
  if (enc.length <= 900) return enc;
  // Pathologically long value: not reversible, but the entity doc stores the real type/value.
  return `${enc.slice(0, 800)}~${createHash("sha256").update(safe).digest("hex")}`;
}
export function decodeDocId(id: string): string {
  return decodeURIComponent(id);
}

/** Dedupes and caps the keys of a report, preserving first-seen order. */
export function normalizeKeys(keys: EntityKey[]): EntityKey[] {
  return [...new Set(keys.map((k) => wellFormed(k) as EntityKey))].slice(0, MAX_KEYS_PER_REPORT);
}

/** Map-key sanitiser for stats.byState: no path-ish chars, and never a Firestore-reserved `__x__` name. */
export function statKey(s: string): string {
  const k = s.trim().slice(0, 60).replace(/[^\p{L}\p{N} _&'()-]/gu, "_");
  return /^__.*__$/.test(k) ? `s${k}` : k;
}

function bump(m: Record<string, number>, k: string): void {
  m[k] = (Object.hasOwn(m, k) ? m[k] : 0) + 1;
}

export interface ReportPlan {
  newlyCounted: EntityKey[];
  entities: Map<EntityKey, EntityDoc>;       // docs to write (only newly counted keys)
  daily?: DailyStats;                        // new value, only when something was newly counted
  recent?: RecentDoc;
}

/**
 * Pure core of addReport, shared by MemoryStore and FirestoreStore so both behave identically.
 * `counted` = keys this uid has already reported; `existing` = current entity docs; `daily`/`recent` = current stats docs.
 */
export function planReport(args: {
  report: ReportInput; keys: EntityKey[]; counted: ReadonlySet<EntityKey>;
  existing: ReadonlyMap<EntityKey, EntityDoc | undefined>;
  daily: DailyStats | undefined; recent: RecentDoc | undefined; now: string;
}): ReportPlan {
  const { report, keys, counted, existing, now } = args;
  const newlyCounted = keys.filter((k) => !counted.has(k));
  const entities = new Map<EntityKey, EntityDoc>();
  if (newlyCounted.length === 0) return { newlyCounted, entities };

  for (const key of newlyCounted) {
    const cur = existing.get(key);
    const { type, value } = splitKey(key);
    const others = keys.filter((k) => k !== key);
    const doc: EntityDoc = cur
      ? { ...cur, scamTypes: [...cur.scamTypes], linked: [...cur.linked] }
      : { type, value, reportCount: 0, scamTypes: [], linked: [], firstSeen: now, lastSeen: now };
    doc.reportCount += 1;
    doc.lastSeen = now;
    if (!doc.scamTypes.includes(report.scamType)) doc.scamTypes.push(report.scamType);
    for (const o of others) {
      if (doc.linked.length >= LINKED_CAP) break;
      if (o !== key && !doc.linked.includes(o)) doc.linked.push(o);
    }
    entities.set(key, doc);
  }

  const daily: DailyStats = {
    total: (args.daily?.total ?? 0) + 1,
    byType: { ...(args.daily?.byType ?? {}) },
    byState: { ...(args.daily?.byState ?? {}) },
  };
  bump(daily.byType, report.scamType);
  const st = report.state ? statKey(report.state) : "";
  if (st) bump(daily.byState, st);

  // Most recently reported first; one row per masked identifier.
  let items = [...(args.recent?.items ?? [])];
  for (const [key, doc] of [...entities].reverse()) {
    const masked = maskIdentifier(key);
    items = items.filter((i) => !(i.masked === masked && i.type === doc.type));
    items.unshift({ masked, type: doc.type, scamType: report.scamType, reportCount: doc.reportCount, lastSeen: now });
  }
  return { newlyCounted, entities, daily, recent: { items: items.slice(0, RECENT_CAP) } };
}

export function toHit(key: EntityKey, d: EntityDoc): EntityHit {
  return { key, reportCount: d.reportCount, scamTypes: [...d.scamTypes], linked: [...d.linked], lastSeen: d.lastSeen };
}

/** Firestore rejects `undefined` and lone surrogates; this JSON round-trip drops/repairs them (and gives callers a private copy). */
export function cleanClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v, (_k, x: unknown) => (typeof x === "string" ? wellFormed(x) : x))) as T;
}

export interface StoreOptions { now?: () => Date }

/** Read-side helpers used by tests/ops; not part of the `Store` contract the routes need. */
export interface StoreInspect {
  getDailyStats(day: string): Promise<DailyStats | null>;
  getRecent(): Promise<RecentItem[]>;
}

/** reports/{id}: server-only audit record. Deliberately carries no reporter UID. */
export function reportDoc(r: ReportInput, keys: EntityKey[], newlyCounted: EntityKey[], createdAt: string): Record<string, unknown> {
  return cleanClone({
    checkId: r.checkId, entityKeys: keys, newlyCounted, scamType: r.scamType,
    state: r.state, city: r.city, day: r.day, createdAt,
  });
}

export class MemoryStore implements Store, StoreInspect {
  private readonly now: () => Date;
  private readonly entities = new Map<EntityKey, EntityDoc>();
  private readonly reporters = new Map<EntityKey, Set<string>>();
  private readonly checks = new Map<string, StoredCheck>();
  private readonly daily = new Map<string, DailyStats>();
  private recent: RecentDoc | undefined;
  private readonly usage = new Map<string, number>();
  readonly reports: Array<Record<string, unknown>> = [];

  constructor(opts: StoreOptions = {}) { this.now = opts.now ?? (() => new Date()); }

  /** Test/seed helper: plant an entity doc as the seed script would. */
  putEntity(key: EntityKey, doc: EntityDoc): void { this.entities.set(key, cleanClone(doc)); }

  async getHits(keys: EntityKey[]): Promise<EntityHit[]> {
    const out: EntityHit[] = [];
    for (const key of new Set(keys.map((k) => wellFormed(k) as EntityKey))) {
      const d = this.entities.get(key);
      if (d && d.reportCount > 0) out.push(toHit(key, d));
    }
    return out;
  }

  async saveCheck(c: StoredCheck): Promise<void> { this.checks.set(c.id, cleanClone(c)); }
  async getCheck(id: string): Promise<StoredCheck | null> {
    const c = this.checks.get(id);
    return c ? cleanClone(c) : null;
  }

  async addReport(r: ReportInput): Promise<{ reportId: string; newlyCounted: EntityKey[] }> {
    // No awaits between read and write: single-threaded JS makes this atomic.
    const keys = normalizeKeys(r.entityKeys);
    const counted = new Set(keys.filter((k) => this.reporters.get(k)?.has(r.uid)));
    const existing = new Map(keys.map((k) => [k, this.entities.get(k)] as const));
    const nowIso = this.now().toISOString();
    const plan = planReport({ report: r, keys, counted, existing, daily: this.daily.get(r.day), recent: this.recent, now: nowIso });
    for (const [key, doc] of plan.entities) {
      this.entities.set(key, doc);
      let s = this.reporters.get(key);
      if (!s) this.reporters.set(key, (s = new Set()));
      s.add(r.uid);
    }
    if (plan.daily) this.daily.set(r.day, plan.daily);
    if (plan.recent) this.recent = plan.recent;
    const reportId = randomUUID();
    this.reports.push({ id: reportId, ...reportDoc(r, keys, plan.newlyCounted, nowIso) });
    return { reportId, newlyCounted: plan.newlyCounted };
  }

  async bumpUsage(uid: string, day: string, perUidLimit?: number): Promise<{ uidCount: number; globalCount: number }> {
    const uk = `${uid}_${day}`, gk = `global_${day}`;
    const uidCount = (this.usage.get(uk) ?? 0) + 1;
    this.usage.set(uk, uidCount);
    const within = perUidLimit === undefined || uidCount <= perUidLimit;
    const globalCount = (this.usage.get(gk) ?? 0) + (within ? 1 : 0);
    if (within) this.usage.set(gk, globalCount);
    return { uidCount, globalCount };
  }

  async getDailyStats(day: string): Promise<DailyStats | null> {
    const d = this.daily.get(day);
    return d ? cleanClone(d) : null;
  }
  async getRecent(): Promise<RecentItem[]> { return cleanClone(this.recent?.items ?? []); }
}
