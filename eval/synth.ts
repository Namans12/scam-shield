// Test support: seeded synthetic result sets with exact, known ground truth (no network, no files).
// The expected counts come from how the rows are BUILT (so many scams caught, so many genuine flagged, ...), not from any
// metrics code, so a test can compare the code under test to them.
import { SCAM_TYPES, type ScamType } from "@scam-shield/shared";
import type { EvalRow } from "./metrics";

/** mulberry32: small, fast, deterministic PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** In-place Fisher-Yates shuffle with the given PRNG. */
export function shuffle<T>(a: T[], rnd: () => number): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export interface Plan {
  seed: number;
  /** Scams with a Scam or Suspicious verdict, of which `typeWrong` carry the wrong predicted type. */
  scamsCaught?: number;
  typeWrong?: number;
  /** Scams judged "no_signs" (a miss). */
  scamsMissed?: number;
  /** Scams that returned an error (a miss, and wrong). */
  scamsErrors?: number;
  legitFlagged?: number;
  legitCleared?: number;
  legitErrors?: number;
  /** Ambiguous inputs by verdict, plus errors. */
  ambScam?: number;
  ambSuspicious?: number;
  ambNoSigns?: number;
  ambErrors?: number;
  /** Prefix for ids (to keep ids unique across several datasets). */
  idPrefix?: string;
}

export interface Expected {
  total: number;
  scams: number;
  legit: number;
  ambiguous: number;
  scored: number;
  errors: number;
  correct: number;
  scamsFlagged: number;
  legitFlagged: number;
  legitAnswered: number;
  typeHits: number;
  /** Per kind: the latencies of every successful row are exactly 10, 20, ... 10*count ms (a permutation), so percentiles are known in closed form. */
  successfulByKind: Record<string, number>;
}

const KINDS = ["text", "image", "audio"] as const;
const TYPES = SCAM_TYPES.filter((t) => t !== "none" && t !== "other") as ScamType[];

export function buildDataset(plan: Plan): { rows: EvalRow[]; expected: Expected } {
  const rnd = mulberry32(plan.seed);
  const p = { scamsCaught: 0, scamsMissed: 0, legitFlagged: 0, legitCleared: 0, typeWrong: 0, scamsErrors: 0, legitErrors: 0, ambScam: 0, ambSuspicious: 0, ambNoSigns: 0, ambErrors: 0, idPrefix: "r", ...plan };
  if (p.typeWrong > p.scamsCaught) throw new Error("typeWrong cannot exceed scamsCaught");
  const rows: EvalRow[] = [];
  const add = (n: number, make: (i: number) => Partial<EvalRow> & Pick<EvalRow, "label">) => {
    for (let i = 0; i < n; i++) rows.push({ id: "", kind: "text", ...make(i) });
  };
  const pickType = () => TYPES[Math.floor(rnd() * TYPES.length)]!;
  const otherType = (t: ScamType) => TYPES[(TYPES.indexOf(t) + 1 + Math.floor(rnd() * (TYPES.length - 1))) % TYPES.length]!;
  add(p.scamsCaught, (i) => { const t = pickType(); return { label: "scam", scamType: t, verdict: rnd() < 0.7 ? "scam" : "suspicious", predictedType: i < p.typeWrong ? otherType(t) : t }; });
  add(p.scamsMissed, () => { const t = pickType(); return { label: "scam", scamType: t, verdict: "no_signs", predictedType: "none" }; });
  add(p.scamsErrors, () => ({ label: "scam", scamType: pickType(), error: "502 analysis_failed" }));
  add(p.legitFlagged, () => ({ label: "legit", verdict: rnd() < 0.5 ? "scam" : "suspicious", predictedType: pickType() }));
  add(p.legitCleared, () => ({ label: "legit", verdict: "no_signs", predictedType: "none" }));
  add(p.legitErrors, () => ({ label: "legit", error: "429 daily_limit" }));
  add(p.ambScam, () => ({ label: "ambiguous", verdict: "scam", predictedType: pickType() }));
  add(p.ambSuspicious, () => ({ label: "ambiguous", verdict: "suspicious", predictedType: pickType() }));
  add(p.ambNoSigns, () => ({ label: "ambiguous", verdict: "no_signs", predictedType: "none" }));
  add(p.ambErrors, () => ({ label: "ambiguous", error: "503 upstream" }));
  shuffle(rows, rnd);
  const successfulByKind: Record<string, number> = {};
  rows.forEach((r, i) => {
    r.id = `${p.idPrefix}${String(i).padStart(7, "0")}`;
    r.kind = KINDS[Math.floor(rnd() * KINDS.length)]!;
    r.category = r.label === "scam" ? "realistic_scam" : r.label === "legit" ? "bank_alert" : "ambiguous";
    if (r.error) r.latencyMs = 999_999; // a failed call's latency must never reach the statistics
    else successfulByKind[r.kind] = (successfulByKind[r.kind] ?? 0) + 1;
  });
  for (const kind of KINDS) {
    const ok = rows.filter((r) => r.kind === kind && !r.error);
    const perm = shuffle(ok.map((_, i) => (i + 1) * 10), rnd);
    ok.forEach((r, i) => { r.latencyMs = perm[i]; });
  }
  const scams = p.scamsCaught + p.scamsMissed + p.scamsErrors;
  const legit = p.legitFlagged + p.legitCleared + p.legitErrors;
  const ambiguous = p.ambScam + p.ambSuspicious + p.ambNoSigns + p.ambErrors;
  return {
    rows,
    expected: {
      total: scams + legit + ambiguous, scams, legit, ambiguous, scored: scams + legit,
      errors: p.scamsErrors + p.legitErrors,
      correct: p.scamsCaught + p.legitCleared,
      scamsFlagged: p.scamsCaught, legitFlagged: p.legitFlagged,
      legitAnswered: p.legitFlagged + p.legitCleared,
      typeHits: p.scamsCaught - p.typeWrong,
      successfulByKind,
    },
  };
}

/** Closed-form linear-interpolation percentile of the values 10, 20, ... 10*n. */
export function expectedPercentile(n: number, pct: number): number {
  if (n === 0) return 0;
  return 10 * (1 + (pct / 100) * (n - 1));
}
