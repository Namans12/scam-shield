import { useEffect, useRef, useState } from "react";

/**
 * A number that "calculates" when it scrolls into view: its digits flicker randomly, then lock in one by one,
 * left to right, until the real value shows. Screen readers get the final value only; with reduced motion
 * (or where there is no layout, as in tests) the final value is shown at once.
 */
export function ScrambleNumber({ value, delay = 0, duration = 1500 }: { value: string; delay?: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);

  useEffect(() => {
    setShown(value);
    const el = ref.current;
    if (!el) return;
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || typeof IntersectionObserver === "undefined") return;

    const digits = [...value].map((ch, i) => (/\d/.test(ch) ? i : -1)).filter((i) => i >= 0);
    let timer = 0;
    let frame = 0;
    const run = () => {
      const start = performance.now() + delay;
      let last = 0;
      const tick = (now: number) => {
        const t = (now - start) / duration;
        if (t < 0) {
          // waiting for its turn: already jumbled so it never shows the final value early
          if (now - last > 60) { last = now; setShown(jumble(value, digits, 0)); }
          frame = requestAnimationFrame(tick);
          return;
        }
        if (t >= 1) { setShown(value); return; }
        if (now - last > 55) { last = now; setShown(jumble(value, digits, t)); }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };

    setShown(jumble(value, digits, 0));
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        run();
      }
    }, { threshold: 0.6 });
    io.observe(el);
    return () => {
      io.disconnect();
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [value, delay, duration]);

  return (
    <>
      <span className="sr-only">{value}</span>
      <span ref={ref} aria-hidden className="scramble-number">{shown}</span>
    </>
  );
}

/** Digit i locks once progress passes (i + 1) / (digits + 1); the others show random digits. */
function jumble(value: string, digitIndexes: number[], progress: number): string {
  const chars = [...value];
  digitIndexes.forEach((pos, n) => {
    if (progress < (n + 1) / (digitIndexes.length + 1)) chars[pos] = String(Math.floor(Math.random() * 10));
  });
  return chars.join("");
}
