import { describe, expect, it } from "vitest";
import { lastDays, summariseTrends } from "./data";

describe("lastDays", () => {
  it("returns seven IST days, oldest first, ending today in India", () => {
    // 20:00 UTC on 16 Oct is already 17 Oct 01:30 in India.
    const days = lastDays(7, new Date("2026-10-16T20:00:00Z"));
    expect(days).toHaveLength(7);
    expect(days[0]).toBe("2026-10-11");
    expect(days[6]).toBe("2026-10-17");
  });
});

describe("summariseTrends", () => {
  it("adds up days and ranks types and states", () => {
    const s = summariseTrends([
      { day: "2026-10-15", total: 5, byType: { kyc_update: 3, job_task: 2 }, byState: { Delhi: 3, Goa: 2 } },
      { day: "2026-10-16", total: 4, byType: { kyc_update: 1, digital_arrest: 3 }, byState: { Delhi: 1, Kerala: 3 } },
    ]);
    expect(s.total).toBe(9);
    expect(s.byType[0]).toEqual({ key: "kyc_update", count: 4 });
    expect(s.byType.map((r) => r.key)).toEqual(["kyc_update", "digital_arrest", "job_task"]);
    expect(s.byState.map((r) => r.key)).toEqual(["Delhi", "Kerala", "Goa"]);
  });

  it("handles no data", () => {
    expect(summariseTrends([])).toEqual({ total: 0, byType: [], byState: [] });
  });
});
