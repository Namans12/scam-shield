import { useLayoutEffect, useRef, useState } from "react";

/** Number of digits after the decimal point in a value string such as "97.6" (1) or "100" (0). */
function decimalsOf(value: string): number {
  const dot = value.indexOf(".");
  return dot < 0 ? 0 : value.length - dot - 1;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * The text shown at `progress` (0..1) while counting from `from` to the number in `value`. It always has as many
 * decimals as `value`, and at progress 1 it is exactly `value`.
 */
export function countText(value: string, from: number, progress: number): string {
  if (progress >= 1) return value;
  const target = Number.parseFloat(value);
  if (!Number.isFinite(target)) return value;
  const now = from + (target - from) * easeOutCubic(Math.max(0, progress));
  return now.toFixed(decimalsOf(value));
}

function canAnimate(): boolean {
  if (typeof window === "undefined" || typeof IntersectionObserver === "undefined" || typeof requestAnimationFrame !== "function") return false;
  const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return !reduce;
}

/**
 * A number that counts when it scrolls into view: from `from` (0 by default) to `value`, up or down, with an
 * ease-out curve. Before it starts it shows the start value, never the final one. Screen readers get the final value
 * only. With reduced motion, or where nothing can animate (as in tests), the final value shows at once.
 * `suffix` (such as "%") sits right after the number, inside the reserved width. `value` is a string so that its decimals ("97.6") are kept at every step and the last frame is exactly `value`.
 */
export function CountNumber({ value, from = 0, delay = 0, duration = 2000, suffix = "" }: { value: string; from?: number; delay?: number; duration?: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const decimals = decimalsOf(value);
  const startText = from.toFixed(decimals);
  const [shown, setShown] = useState(() => (canAnimate() ? startText : value));

  useLayoutEffect(() => {
    const el = ref.current;
    const target = Number.parseFloat(value);
    if (!el || !canAnimate() || !Number.isFinite(target) || target === from) {
      setShown(value);
      return;
    }
    setShown(startText);

    let frame = 0;
    let began: number | null = null;
    let last = startText;
    const show = (text: string) => {
      if (text !== last) { last = text; setShown(text); }
    };
    const tick = (now: number) => {
      began ??= now;
      const t = (now - began - delay) / duration;
      if (t >= 1) { show(value); return; }
      show(countText(value, from, t));
      frame = requestAnimationFrame(tick);
    };
    let started = false;
    const io = new IntersectionObserver((entries) => {
      if (!started && entries.some((e) => e.isIntersecting)) {
        started = true;
        io.disconnect();
        frame = requestAnimationFrame(tick);
      }
    }, { threshold: 0.5 });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, from, delay, duration, startText]);

  // The sizer holds the widest text (via a CSS pseudo-element, so it is not a second copy of the number in the DOM).
  const widest = [startText, value].reduce((a, b) => (b.length > a.length ? b : a));
  return (
    <span ref={ref} className="count-number" role="img" aria-label={value + suffix} data-sizer={widest + suffix}>
      <span className="count-number-line"><span className="count-number-text">{shown}</span>{suffix ? <span className="count-number-suffix">{suffix}</span> : null}</span>
    </span>
  );
}
