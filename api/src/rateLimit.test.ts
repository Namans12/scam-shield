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

  it("fails closed for new keys when full, but still serves tracked keys", () => {
    const c = clock();
    const rl = createRateLimiter({ max: 5, maxKeys: 3, now: c.now });
    rl.isLimited("a"); rl.isLimited("b"); rl.isLimited("c");
    expect(rl.isLimited("new")).toBe(true);
    expect(rl.size()).toBe(3);
    expect(rl.isLimited("a")).toBe(false);
    c.advance(61_000);
    expect(rl.isLimited("new")).toBe(false);
  });
});
