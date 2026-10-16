// Per-instance fixed-window request counter, keyed by a string (the client IP).
// Resets on cold start and is not shared across Cloud Run instances: it only has to
// deter one noisy client from burning the Gemini quota; the per-uid and global daily
// counters in the store are the real cost guard.
//
// A warm instance can live for hours and every distinct key adds an entry, and
// X-Forwarded-For is attacker-influenced, so a caller can mint a new key per request.
// Two bounds because they fail differently: the sweep keeps steady-state memory
// proportional to *active* keys, and the hard cap holds under a deliberate flood.

export interface RateLimiterOptions {
  /** Requests allowed per window per key. */
  max: number;
  windowMs?: number;
  maxKeys?: number;
  /** Clock in ms; injectable for tests. */
  now?: () => number;
}

export interface RateLimiter {
  /** Counts this request and returns true when the key is over its limit. */
  isLimited(key: string): boolean;
  size(): number;
}

interface Bucket { count: number; windowStart: number }

export const DEFAULT_WINDOW_MS = 60_000;
export const DEFAULT_MAX_KEYS = 10_000;

export function createRateLimiter(opts: RateLimiterOptions): RateLimiter {
  const windowMs = opts.windowMs ?? DEFAULT_WINDOW_MS;
  const maxKeys = opts.maxKeys ?? DEFAULT_MAX_KEYS;
  const clock = opts.now ?? Date.now;
  const buckets = new Map<string, Bucket>();
  let lastSweep = 0;

  // Drops buckets whose window has lapsed (they would be reset on their owner's next request
  // anyway). Runs at most once per window so the cost is amortised.
  function sweep(now: number): void {
    if (now - lastSweep < windowMs) return;
    lastSweep = now;
    for (const [key, b] of buckets) if (now - b.windowStart > windowMs) buckets.delete(key);
  }

  return {
    isLimited(key) {
      const now = clock();
      sweep(now);
      const b = buckets.get(key);
      if (!b || now - b.windowStart > windowMs) {
        // Only a *new* key can hit the cap; an existing key refreshing its window is never
        // turned away for capacity. When a flood of unique keys fills the table, fail closed:
        // an untracked caller is treated as limited, so "fill the table, then attack" fails.
        if (!b && buckets.size >= maxKeys) return true;
        buckets.set(key, { count: 1, windowStart: now });
        return false;
      }
      b.count += 1;
      return b.count > opts.max;
    },
    size: () => buckets.size,
  };
}
