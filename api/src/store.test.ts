import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { EntityKey } from "@scam-shield/shared";
import { MemoryStore, decodeDocId, encodeDocId, normalizeKeys, planReport, statKey } from "./store";
import type { DailyStats, EntityDoc, ReportInput, Store, StoreInspect } from "./store";
import { FirestoreStore } from "./firestoreStore";

const DAY = "2026-10-16";
const PHONE: EntityKey = "phone:+917000011111";
const UPI: EntityKey = "upi:a@ybl";

type Inspectable = Store & StoreInspect & { seed(key: EntityKey, doc: EntityDoc): Promise<void> };

/** Behavioural suite run against EVERY Store implementation. */
function storeSuite(name: string, make: () => Promise<Inspectable> | Inspectable, opts: { skip?: boolean } = {}) {
  describe.skipIf(opts.skip)(`Store behaviour: ${name}`, { timeout: 30_000 }, () => {
    let s: Inspectable;
    let p = "";
    // Unique prefix per test so a shared emulator DB never leaks state between tests.
    let n = 0;
    const uniq = () => `${Date.now().toString(36)}${(n++).toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    beforeAll(async () => { s = await make(); });
    const k = (type: string, v: string) => `${type}:${v}${p}` as EntityKey;
    const day = () => `2030-01-${String(1 + (n % 28)).padStart(2, "0")}-${p}`; // isolated stats doc per test
    const setup = () => { p = uniq(); };
    const rep = (o: Partial<ReportInput> & Pick<ReportInput, "uid" | "entityKeys">): ReportInput =>
      ({ checkId: "c", scamType: "kyc_update", day: DAY, ...o });

    it("matches the brief scenario (verbatim)", async () => {
      setup();
      const d = day();
      const phone = k("phone", "+9170" + Math.floor(Math.random() * 1e8)) as EntityKey;
      const upi = k("upi", "a@ybl") as EntityKey;
      const u1 = "u1" + p, u2 = "u2" + p;
      const r1 = await s.addReport({ uid: u1, checkId: "c1", entityKeys: [phone, upi], scamType: "kyc_update", day: d });
      expect(r1.newlyCounted).toEqual([phone, upi]);
      const again = await s.addReport({ uid: u1, checkId: "c2", entityKeys: [phone], scamType: "kyc_update", day: d });
      expect(again.newlyCounted).toEqual([]);
      await s.addReport({ uid: u2, checkId: "c3", entityKeys: [phone], scamType: "digital_arrest", day: d });
      const [hit] = await s.getHits([phone]);
      expect(hit).toMatchObject({ reportCount: 2, scamTypes: ["kyc_update", "digital_arrest"], linked: [upi] });
      expect(await s.getHits(["phone:+910000000000" + p as EntityKey])).toEqual([]);
      expect((await s.bumpUsage(u1, d)).uidCount).toBe(1);
      expect((await s.bumpUsage(u1, d)).uidCount).toBe(2);
    });

    it("hit shape: key, ISO lastSeen, never links to itself", async () => {
      setup();
      const a = k("phone", "+919000000001"), b = k("upi", "x@ok");
      await s.addReport(rep({ uid: "u" + p, entityKeys: [a, b, a], day: day() }));
      const [h] = await s.getHits([a]);
      expect(h.key).toBe(a);
      expect(h.linked).toEqual([b]);
      expect(h.linked).not.toContain(a);
      expect(new Date(h.lastSeen).toISOString()).toBe(h.lastSeen);
    });

    it("getHits only returns reported keys, preserves input order, dedupes", async () => {
      setup();
      const a = k("phone", "+919000000002"), b = k("domain", "evil.example"), c = k("acct", "123456789");
      await s.addReport(rep({ uid: "u" + p, entityKeys: [b, a], day: day() }));
      const hits = await s.getHits([a, c, b, a]);
      expect(hits.map((h) => h.key)).toEqual([a, b]);
      expect(await s.getHits([])).toEqual([]);
    });

    it("empty entityKeys: returns a reportId, counts nothing, touches no stats", async () => {
      setup();
      const d = day();
      const r = await s.addReport(rep({ uid: "u" + p, entityKeys: [], day: d }));
      expect(r.newlyCounted).toEqual([]);
      expect(r.reportId).toBeTruthy();
      expect(await s.getDailyStats(d)).toBeNull();
    });

    it("caps linked at 20, de-duplicated, and never includes the entity itself", async () => {
      setup();
      const all = Array.from({ length: 26 }, (_, i) => k("upi", `m${i}@ybl`));
      await s.addReport(rep({ uid: "u1" + p, entityKeys: all, day: day() }));
      const [h] = await s.getHits([all[0]]);
      expect(h.linked).toHaveLength(20);
      expect(new Set(h.linked).size).toBe(20);
      expect(h.linked).not.toContain(all[0]);
      expect(h.linked).toEqual(all.slice(1, 21));
      // another reporter links the same entity to the same keys again: still capped, still unique
      await s.addReport(rep({ uid: "u2" + p, entityKeys: [all[0], ...all.slice(1, 6)], day: day() }));
      const [h2] = await s.getHits([all[0]]);
      expect(h2.linked).toHaveLength(20);
      expect(new Set(h2.linked).size).toBe(20);
      expect(h2.reportCount).toBe(2);
    });

    it("scamTypes are distinct, in order first seen; reportCount = distinct reporters", async () => {
      setup();
      const a = k("phone", "+919000000003");
      for (const [u, t] of [["u1", "kyc_update"], ["u2", "digital_arrest"], ["u3", "kyc_update"], ["u1", "investment"]] as const) {
        await s.addReport(rep({ uid: u + p, entityKeys: [a], scamType: t, day: day() }));
      }
      const [h] = await s.getHits([a]);
      expect(h.reportCount).toBe(3);
      expect(h.scamTypes).toEqual(["kyc_update", "digital_arrest"]); // u1's repeat did not add "investment"
    });

    it("a repeat report counts only keys not yet counted for that user", async () => {
      setup();
      const a = k("phone", "+919000000004"), b = k("upi", "q@ybl");
      const u = "u" + p;
      await s.addReport(rep({ uid: u, entityKeys: [a], day: day() }));
      const r = await s.addReport(rep({ uid: u, entityKeys: [a, b], day: day() }));
      expect(r.newlyCounted).toEqual([b]);
      const hits = await s.getHits([a, b]);
      expect(hits.find((h) => h.key === a)?.reportCount).toBe(1);
      expect(hits.find((h) => h.key === b)).toMatchObject({ reportCount: 1, linked: [a] });
    });

    it("daily stats increment only for newly counted reports", async () => {
      setup();
      const d = day();
      const a = k("phone", "+919000000005");
      await s.addReport(rep({ uid: "u1" + p, entityKeys: [a], scamType: "kyc_update", state: "Maharashtra", day: d }));
      await s.addReport(rep({ uid: "u1" + p, entityKeys: [a], scamType: "kyc_update", state: "Maharashtra", day: d })); // repeat
      await s.addReport(rep({ uid: "u2" + p, entityKeys: [a], scamType: "digital_arrest", state: "Delhi", day: d }));
      await s.addReport(rep({ uid: "u3" + p, entityKeys: [a], scamType: "digital_arrest", day: d })); // no state
      expect(await s.getDailyStats(d)).toEqual({
        total: 3, byType: { kyc_update: 1, digital_arrest: 2 }, byState: { Maharashtra: 1, Delhi: 1 },
      });
    });

    it("stats/recent holds masked identifiers only, newest first, one row per identifier, capped at 10", async () => {
      setup();
      const reportedBefore = (await s.getRecent()).length;
      void reportedBefore;
      const keys = Array.from({ length: 12 }, (_, i) => k("phone", `+9190000${String(i).padStart(5, "0")}`));
      for (let i = 0; i < keys.length; i++) await s.addReport(rep({ uid: "u1" + p, entityKeys: [keys[i]], day: day() }));
      await s.addReport(rep({ uid: "u2" + p, entityKeys: [keys[5]], scamType: "investment", day: day() }));
      const items = await s.getRecent();
      expect(items.length).toBeLessThanOrEqual(10);
      expect(items).toHaveLength(10);
      expect(items[0]).toMatchObject({ type: "phone", scamType: "investment", reportCount: 2 });
      const text = JSON.stringify(items);
      expect(text).not.toContain(keys[5].slice(6)); // raw number never present
      expect(text).toContain("X");                  // masked
      expect(text).not.toContain("u1" + p);         // no reporter uid
      expect(items.filter((i) => i.masked === items[0].masked)).toHaveLength(1);
      for (const i of items) expect(Object.keys(i).sort()).toEqual(["lastSeen", "masked", "reportCount", "scamType", "type"]);
    });

    it("seeded entities count toward reportCount like real ones", async () => {
      setup();
      const a = k("phone", "+919000000006");
      const seeded: EntityDoc = { type: "phone", value: a.slice(6), reportCount: 14, scamTypes: ["fake_payment"], linked: [], firstSeen: "2026-01-01T00:00:00.000Z", lastSeen: "2026-01-02T00:00:00.000Z", seeded: true };
      await s.seed(a, seeded);
      expect((await s.getHits([a]))[0].reportCount).toBe(14);
      await s.addReport(rep({ uid: "u1" + p, entityKeys: [a], scamType: "kyc_update", day: day() }));
      expect((await s.getHits([a]))[0]).toMatchObject({ reportCount: 15, scamTypes: ["fake_payment", "kyc_update"] });
    });

    it("concurrent reports from different users on the same key are both counted", async () => {
      setup();
      const a = k("phone", "+919000000007"), b = k("upi", "z@ybl");
      const d = day();
      await Promise.all([
        s.addReport(rep({ uid: "u1" + p, entityKeys: [a, b], scamType: "kyc_update", day: d })),
        s.addReport(rep({ uid: "u2" + p, entityKeys: [a], scamType: "digital_arrest", day: d })),
        s.addReport(rep({ uid: "u3" + p, entityKeys: [a], scamType: "digital_arrest", day: d })),
      ]);
      const [h] = await s.getHits([a]);
      expect(h.reportCount).toBe(3);
      expect(h.scamTypes.slice().sort()).toEqual(["digital_arrest", "kyc_update"]);
      expect((await s.getDailyStats(d))?.total).toBe(3);
    });

    it("concurrent repeats from the SAME user count once", async () => {
      setup();
      const a = k("phone", "+919000000008");
      const res = await Promise.all([1, 2, 3].map(() => s.addReport(rep({ uid: "u" + p, entityKeys: [a], day: day() }))));
      expect(res.flatMap((r) => r.newlyCounted)).toEqual([a]);
      expect((await s.getHits([a]))[0].reportCount).toBe(1);
    });

    it("keys with / % # etc. do not crash and round-trip", async () => {
      setup();
      const weird = [k("domain", "evil.example/a/b?c=1#d"), k("upi", "we%ird@ybl"), k("acct", "\uD800lone"), k("phone", "+91 ../..")];
      const r = await s.addReport(rep({ uid: "u/1" + p, entityKeys: weird, day: day() }));
      const stored = weird.map((w) => w.replace("\uD800", "�")); // lone surrogates are repaired, identically in every store
      expect(r.newlyCounted).toEqual(stored);
      const hits = await s.getHits(weird);
      expect(hits.map((h) => h.key)).toEqual(stored);
    });

    it("bumpUsage counts per user and globally per day, atomically under concurrency", async () => {
      setup();
      const d = day();
      const out = await Promise.all(Array.from({ length: 8 }, (_, i) => s.bumpUsage(`${i % 2 ? "a" : "b"}${p}`, d)));
      expect(out.map((o) => o.globalCount).sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(out.filter((o) => o.uidCount === 4)).toHaveLength(2);
      expect((await s.bumpUsage(`a${p}`, d)).uidCount).toBe(5);
      expect((await s.bumpUsage(`a${p}`, "2030-02-01-" + p)).uidCount).toBe(1); // new day resets
    });

    it("saveCheck/getCheck round-trip, tolerate undefined fields and odd ids, null when missing", async () => {
      setup();
      const id = "chk/" + p;
      const check = {
        id, createdAt: "2026-10-16T00:00:00.000Z", inputKind: "text", entityKeys: [PHONE], hits: [], hardSignals: [], latencyMs: 12,
        verdict: "scam", risk_score: 90, scam_type: "kyc_update", summary: "s", red_flags: [], next_steps: [],
        entities: { phones: [], upi_ids: [], urls: [], bank_accounts: [], brands_impersonated: [] }, language: "en",
        uid: "u1", redactedText: undefined, qr: undefined,
      } as unknown as Parameters<Store["saveCheck"]>[0];
      await s.saveCheck(check);
      const got = await s.getCheck(id);
      expect(got).toMatchObject({ id, uid: "u1", risk_score: 90 });
      expect(got && "redactedText" in got).toBe(false);
      expect(await s.getCheck("missing" + p)).toBeNull();
    });
  });
}

storeSuite("MemoryStore", () => {
  const m = new MemoryStore();
  (m as unknown as Inspectable).seed = async (key, doc) => m.putEntity(key, doc);
  return m as unknown as Inspectable;
});

const emulator = !!process.env.FIRESTORE_EMULATOR_HOST;
let fsApp: import("firebase-admin/app").App | undefined;
storeSuite("FirestoreStore (emulator)", async () => {
  const { initializeApp } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  const app = initializeApp({ projectId: "demo-scam-shield" }, `store-test-${Date.now()}`);
  fsApp = app;
  const db = getFirestore(app);
  const fs = new FirestoreStore(db);
  (fs as unknown as Inspectable).seed = async (key, doc) => { await db.doc(`entities/${encodeDocId(key)}`).set(doc); };
  return fs as unknown as Inspectable;
}, { skip: !emulator });
afterAll(async () => { if (fsApp) { const { deleteApp } = await import("firebase-admin/app"); await deleteApp(fsApp); } });

describe("pure helpers", () => {
  it("encodeDocId/decodeDocId round-trip and never contain /", () => {
    for (const key of ["phone:+917000011111", "upi:a@ybl", "domain:evil.example/a/b", "acct:1%2F2", "upi:ü@ok", "domain:a b?c#d"]) {
      const id = encodeDocId(key);
      expect(id).not.toContain("/");
      expect(decodeDocId(id)).toBe(key);
    }
    expect(encodeDocId("phone:+917000011111")).toBe("phone%3A%2B917000011111");
  });
  it("encodeDocId survives lone surrogates and very long values; ids never look reserved", () => {
    expect(() => encodeDocId("acct:\uD800x")).not.toThrow();
    const long = encodeDocId("domain:" + "a".repeat(5000));
    expect(long.length).toBeLessThan(1000);
    expect(long).not.toContain("/");
    expect(encodeDocId("domain:" + "a".repeat(5000))).toBe(long); // deterministic
    expect(encodeDocId("a")).not.toMatch(/^\.{1,2}$/);
  });
  it("normalizeKeys dedupes, preserves order, caps", () => {
    expect(normalizeKeys([PHONE, UPI, PHONE])).toEqual([PHONE, UPI]);
    expect(normalizeKeys(Array.from({ length: 150 }, (_, i) => `upi:${i}@a` as EntityKey))).toHaveLength(100);
  });
  it("statKey sanitises path chars and reserved names", () => {
    expect(statKey(" Tamil Nadu ")).toBe("Tamil Nadu");
    expect(statKey("a.b/c")).toBe("a_b_c");
    expect(statKey("__proto__")).toBe("s__proto__");
    expect(statKey("__x__")).not.toMatch(/^__.*__$/);
  });
  it("planReport merges daily stats and recent without mutating its inputs", () => {
    const daily: DailyStats = { total: 5, byType: { kyc_update: 3 }, byState: { Delhi: 2 } };
    const frozen = JSON.stringify(daily);
    const plan = planReport({
      report: { uid: "u", checkId: "c", entityKeys: [PHONE, UPI], scamType: "kyc_update", state: "Delhi", day: DAY },
      keys: [PHONE, UPI], counted: new Set([UPI]), existing: new Map(), daily, recent: undefined, now: "2026-10-16T00:00:00.000Z",
    });
    expect(plan.newlyCounted).toEqual([PHONE]);
    expect(plan.daily).toEqual({ total: 6, byType: { kyc_update: 4 }, byState: { Delhi: 3 } });
    expect(JSON.stringify(daily)).toBe(frozen);
    expect(plan.entities.get(PHONE)).toMatchObject({ type: "phone", value: "+917000011111", reportCount: 1, linked: [UPI] });
    expect(plan.recent?.items).toHaveLength(1);
  });
  it("planReport with nothing newly counted yields no stats writes", () => {
    const plan = planReport({
      report: { uid: "u", checkId: "c", entityKeys: [PHONE], scamType: "kyc_update", day: DAY },
      keys: [PHONE], counted: new Set([PHONE]), existing: new Map(), daily: undefined, recent: undefined, now: "x",
    });
    expect(plan.newlyCounted).toEqual([]);
    expect(plan.daily).toBeUndefined();
    expect(plan.recent).toBeUndefined();
  });
});
