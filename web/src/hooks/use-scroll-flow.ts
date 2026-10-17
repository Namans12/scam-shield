import { useEffect, useRef, useState } from "react";

/**
 * Scroll-linked progress for a list that "fills in" as it passes through the viewport.
 *
 * The rail's fill (--flow, 0 to 1) and each node's "reached" state come from the same geometry: a node counts as
 * reached only when the leading edge of the fill has passed the node's centre, so a node never lights up before the
 * line arrives. Vertical lists (rail on the left) follow a reading line at the middle of the screen; horizontal lists
 * fill over about half a screen of scrolling. With reduced motion (or no layout engine, as in tests) everything reads
 * as reached at once.
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
    const RAIL_INSET = 7; // the rail starts at the centre of the first node (a 14px circle)
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const nodes = Array.from(el.querySelectorAll<HTMLElement>(".flow-node"));
      const vh = window.innerHeight || 800;
      const centres = nodes.map((n) => n.getBoundingClientRect());
      const vertical = centres.length > 1 && centres[1]!.top - centres[0]!.top > 4;
      const length = Math.max(1, (vertical ? rect.height : rect.width) - RAIL_INSET);

      let p: number;
      if (vertical) {
        p = (vh * 0.5 - rect.top - RAIL_INSET) / length; // the fill's front sits on the middle of the screen
      } else {
        p = (vh * 0.5 - rect.top) / Math.max(rect.height, vh * 0.4);
      }
      p = Math.min(1, Math.max(0, p));
      el.style.setProperty("--flow", p.toFixed(3));

      const front = RAIL_INSET + p * length;
      let n = 0;
      centres.forEach((c, i) => {
        const centre = vertical ? c.top + c.height / 2 - rect.top : c.left + c.width / 2 - rect.left;
        if (p > 0.004 && front >= centre - 0.5) n = i + 1;
      });
      setReached(Math.min(count, n));
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
