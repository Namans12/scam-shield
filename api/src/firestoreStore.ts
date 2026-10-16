import type { Firestore } from "firebase-admin/firestore";
import type { EntityHit, EntityKey } from "@scam-shield/shared";
import { randomUUID } from "node:crypto";
import {
  cleanClone, encodeDocId, normalizeKeys, planReport, reportDoc, toHit, wellFormed,
} from "./store";
import type {
  DailyStats, EntityDoc, RecentDoc, RecentItem, ReportInput, Store, StoreInspect, StoreOptions, StoredCheck,
} from "./store";

/**
 * Firestore layout (all of it written with the Admin SDK; client rules must deny everything except stats/*):
 *   checks/{id}                         StoredCheck
 *   entities/{encoded key}              EntityDoc                 SERVER-ONLY
 *   entities/{key}/reporters/{uid}      { checkId, createdAt }    SERVER-ONLY (doc id = encoded uid)
 *   reports/{id}                        audit record, no uid      SERVER-ONLY
 *   stats/daily-{yyyy-mm-dd}            DailyStats                client-readable, aggregate only
 *   stats/recent                        { items: RecentItem[] }   client-readable, masked identifiers only
 *   usage/{uid}_{day}, usage/global_{day}   { count }
 * Behavioural logic lives in the pure `planReport` (store.ts) so this class only does I/O.
 */
export class FirestoreStore implements Store, StoreInspect {
  private readonly now: () => Date;
  constructor(private readonly db: Firestore, opts: StoreOptions = {}) {
    this.now = opts.now ?? (() => new Date());
  }

  private entityRef(key: EntityKey) { return this.db.collection("entities").doc(encodeDocId(key)); }
  private reporterRef(key: EntityKey, uid: string) { return this.entityRef(key).collection("reporters").doc(encodeDocId(uid)); }

  async getHits(keys: EntityKey[]): Promise<EntityHit[]> {
    const uniq = [...new Set(keys.map((k) => wellFormed(k) as EntityKey))];
    if (uniq.length === 0) return [];
    const snaps = await this.db.getAll(...uniq.map((k) => this.entityRef(k)));
    const out: EntityHit[] = [];
    snaps.forEach((snap, i) => {
      const d = snap.data() as EntityDoc | undefined;
      if (d && d.reportCount > 0) out.push(toHit(uniq[i], d));
    });
    return out;
  }

  async saveCheck(c: StoredCheck): Promise<void> {
    await this.db.collection("checks").doc(encodeDocId(c.id)).set(cleanClone(c));
  }

  async getCheck(id: string): Promise<StoredCheck | null> {
    const snap = await this.db.collection("checks").doc(encodeDocId(id)).get();
    return snap.exists ? (snap.data() as StoredCheck) : null;
  }

  async addReport(r: ReportInput): Promise<{ reportId: string; newlyCounted: EntityKey[] }> {
    const keys = normalizeKeys(r.entityKeys);
    const reportId = randomUUID();
    const dailyRef = this.db.collection("stats").doc(`daily-${encodeDocId(r.day)}`);
    const recentRef = this.db.collection("stats").doc("recent");
    const reportRef = this.db.collection("reports").doc(reportId);

    const newlyCounted = await this.db.runTransaction(async (tx) => {
      // All reads first (Firestore requires reads before writes in a transaction).
      const refs = [
        ...keys.map((k) => this.reporterRef(k, r.uid)),
        ...keys.map((k) => this.entityRef(k)),
        dailyRef, recentRef,
      ];
      const snaps = await tx.getAll(...refs);
      const n = keys.length;
      const counted = new Set(keys.filter((_, i) => snaps[i].exists));
      const existing = new Map(keys.map((k, i) => [k, snaps[n + i].data() as EntityDoc | undefined] as const));
      const nowIso = this.now().toISOString();
      const plan = planReport({
        report: r, keys, counted, existing,
        daily: snaps[2 * n].data() as DailyStats | undefined,
        recent: snaps[2 * n + 1].data() as RecentDoc | undefined,
        now: nowIso,
      });

      for (const [key, doc] of plan.entities) {
        tx.set(this.entityRef(key), cleanClone(doc));
        tx.set(this.reporterRef(key, r.uid), { checkId: r.checkId, createdAt: nowIso });
      }
      if (plan.daily) tx.set(dailyRef, plan.daily);
      if (plan.recent) tx.set(recentRef, plan.recent);
      tx.set(reportRef, reportDoc(r, keys, plan.newlyCounted, nowIso));
      return plan.newlyCounted;
    });
    return { reportId, newlyCounted };
  }

  async bumpUsage(uid: string, day: string, perUidLimit?: number): Promise<{ uidCount: number; globalCount: number }> {
    const uRef = this.db.collection("usage").doc(`${encodeDocId(uid)}_${day}`);
    const gRef = this.db.collection("usage").doc(`global_${day}`);
    return this.db.runTransaction(async (tx) => {
      const [u, g] = await tx.getAll(uRef, gRef);
      const uidCount = ((u.data()?.count as number | undefined) ?? 0) + 1;
      const within = perUidLimit === undefined || uidCount <= perUidLimit;
      const globalCount = ((g.data()?.count as number | undefined) ?? 0) + (within ? 1 : 0);
      tx.set(uRef, { count: uidCount });
      if (within) tx.set(gRef, { count: globalCount });
      return { uidCount, globalCount };
    });
  }

  async getDailyStats(day: string): Promise<DailyStats | null> {
    const snap = await this.db.collection("stats").doc(`daily-${encodeDocId(day)}`).get();
    return snap.exists ? (snap.data() as DailyStats) : null;
  }

  async getRecent(): Promise<RecentItem[]> {
    const snap = await this.db.collection("stats").doc("recent").get();
    return ((snap.data() as RecentDoc | undefined)?.items ?? []);
  }
}
