import { useEffect, useRef, useState } from "react";

/**
 * Scroll-linked progress for a list that "fills in" as it passes through the viewport.
 * Writes --flow (0 to 1) on the element for the rail, and returns how many items the rail has reached.
 * With reduced motion (or no layout engine, as in tests) everything reads as reached at once.
 */
export function useScrollFlow<T extends HTMLElement>(count: number) {
  const ref = useRef<T>(null);
  const [reached, setReached] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      el.style.setProperty("--flow", "1");
      setReached(count);
      return;
    }
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 800;
      // Starts as the list enters the lower part of the screen and finishes about half a screen of scrolling later.
      const span = Math.max(rect.height * 0.9, vh * 0.5);
      const p = Math.min(1, Math.max(0, (vh * 0.84 - rect.top) / span));
      el.style.setProperty("--flow", p.toFixed(3));
      setReached(p <= 0.02 ? 0 : Math.min(count, 1 + Math.floor(p * count * 0.999)));
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [count]);

  return { ref, reached };
}
