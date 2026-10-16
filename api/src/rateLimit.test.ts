import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rateLimit";

function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => { t += ms; } };
}

describe("createRateLimiter", () => {
  it("allows max requests per window then limits", () => {
    const c = clock();
    const rl = createRateLimiter({ max: 3, now: c.now });
    expect([1, 2, 3].map(() => rl.isLimited("a"))).toEqual([false, false, false]);
    expect(rl.isLimited("a")).toBe(true);
  });

  it("tracks keys independently", () => {
    const c = clock();
    const rl = createRateLimiter({ max: 1, now: c.now });
    expect(rl.isLimited("a")).toBe(false);
    expect(rl.isLimited("b")).toBe(false);
    expect(rl.isLimited("a")).toBe(true);
  });

  it("resets after the 60 s window", () => {
    const c = clock();
    const rl = createRateLimiter({ max: 1, now: c.now });
    rl.isLimited("a");
    expect(rl.isLimited("a")).toBe(true);
    c.advance(60_001);
    expect(rl.isLimited("a")).toBe(false);
  });

  it("sweeps lapsed buckets so memory follows active keys", () => {
    const c = clock();
    const rl = createRateLimiter({ max: 5, now: c.now });
    for (let i = 0; i < 100; i++) rl.isLimited(`ip${i}`);
    expect(rl.size()).toBe(100);
    c.advance(61_000);
    rl.isLimited("fresh");
    expect(rl.size()).toBe(1);
  });

  it("fails OPEN for new keys when the table is full (bounded memory, existing keys still limited)", () => {
    const c = clock();
    const rl = createRateLimiter({ max: 1, maxKeys: 3, now: c.now });
    rl.isLimited("a"); rl.isLimited("b"); rl.isLimited("c");
    // table full: an untracked caller is let through (per-uid and global caps still apply) and is not stored
    for (let i = 0; i < 100; i++) expect(rl.isLimited(`new${i}`)).toBe(false);
    expect(rl.size()).toBe(3);
    // tracked keys keep being limited
    expect(rl.isLimited("a")).toBe(true);
    c.advance(61_000);
    expect(rl.isLimited("new0")).toBe(false);
    expect(rl.isLimited("new0")).toBe(true);
  });
});
