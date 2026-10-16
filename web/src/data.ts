// Reads from Firestore with the client SDK (loaded lazily): the public trend stats, the person's own checks,
// and a single check by id. Firestore rules allow exactly these reads; everything else goes through the API.
import type { CheckResult, ScamType } from "@scam-shield/shared";
import { ensureAnonymousUser, getDb } from "./firebase";

export interface DailyStat { day: string; total: number; byType: Record<string, number>; byState: Record<string, number> }
export interface RecentItem { masked: string; type: string; scamType: ScamType; reportCount: number; lastSeen: string }
export interface Trends { days: DailyStat[]; recent: RecentItem[] }
export interface TrendSummary {
  total: number;
  byType: Array<{ key: string; count: number }>;
  byState: Array<{ key: string; count: number }>;
}

/** The last `n` calendar days as yyyy-mm-dd in IST (the day stats are bucketed by), oldest first. */
export function lastDays(n: number, now: Date = new Date()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(new Date(now.getTime() + 5.5 * 3600_000 - i * 86_400_000).toISOString().slice(0, 10));
  return out;
}

const ranked = (m: Record<string, number>, limit: number) =>
  Object.entries(m)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, limit);

export function summariseTrends(days: DailyStat[]): TrendSummary {
  const byType: Record<string, number> = {};
  const byState: Record<string, number> = {};
  let total = 0;
  for (const d of days) {
    total += d.total;
    for (const [k, v] of Object.entries(d.byType)) byType[k] = (byType[k] ?? 0) + v;
    for (const [k, v] of Object.entries(d.byState)) byState[k] = (byState[k] ?? 0) + v;
  }
  return { total, byType: ranked(byType, 8), byState: ranked(byState, 6) };
}

export async function fetchTrends(now: Date = new Date()): Promise<Trends> {
  const [db, { doc, getDoc }] = await Promise.all([getDb(), import("firebase/firestore")]);
  const [snaps, recent] = await Promise.all([
    Promise.all(lastDays(7, now).map(async (day) => ({ day, snap: await getDoc(doc(db, "stats", `daily-${day}`)) }))),
    getDoc(doc(db, "stats", "recent")),
  ]);
  const days = snaps.flatMap(({ day, snap }) => {
    const d = snap.data() as Partial<DailyStat> | undefined;
    return d ? [{ day, total: d.total ?? 0, byType: d.byType ?? {}, byState: d.byState ?? {} }] : [];
  });
  return { days, recent: ((recent.data() as { items?: RecentItem[] } | undefined)?.items ?? []).slice(0, 10) };
}

/** The person's own most recent checks, newest first. */
export async function fetchHistory(limit = 20): Promise<CheckResult[]> {
  const user = await ensureAnonymousUser();
  const [db, { collection, getDocs, limit: lim, orderBy, query, where }] = await Promise.all([getDb(), import("firebase/firestore")]);
  const snap = await getDocs(query(collection(db, "checks"), where("uid", "==", user.uid), orderBy("createdAt", "desc"), lim(limit)));
  return snap.docs.map((d) => d.data() as CheckResult);
}

/** One of the person's checks by id; null when it does not exist or belongs to someone else. */
export async function fetchCheck(id: string): Promise<CheckResult | null> {
  await ensureAnonymousUser();
  const [db, { doc, getDoc }] = await Promise.all([getDb(), import("firebase/firestore")]);
  try {
    const snap = await getDoc(doc(db, "checks", encodeURIComponent(id)));
    return snap.exists() ? (snap.data() as CheckResult) : null;
  } catch {
    return null; // permission-denied for someone else's check looks the same as "not found"
  }
}
