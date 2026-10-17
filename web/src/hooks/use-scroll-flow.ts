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
      // Vertical rails run exactly from the first node's centre to the last node's centre (their positions depend on
      // the content of each item, so they are measured, not guessed); horizontal rails run on to the end of the row.
      const axisCentre = (c: DOMRect) => c.top + c.height / 2 - rect.top;
      const railTop = vertical ? axisCentre(centres[0]!) : RAIL_INSET;
      const length = vertical ? Math.max(1, axisCentre(centres[centres.length - 1]!) - railTop) : Math.max(1, rect.width - RAIL_INSET);
      if (vertical) {
        el.style.setProperty("--rail-top", `${railTop.toFixed(1)}px`);
        el.style.setProperty("--rail-len", `${length.toFixed(1)}px`);
      } else {
        el.style.removeProperty("--rail-top");
        el.style.removeProperty("--rail-len");
      }

      let p: number;
      if (vertical) {
        p = (vh * 0.5 - rect.top - railTop) / length; // the fill's front sits on the middle of the screen
      } else {
        p = (vh * 0.5 - rect.top) / Math.max(rect.height, vh * 0.4);
      }
      p = Math.min(1, Math.max(0, p));
      el.style.setProperty("--flow", p.toFixed(3));

      const front = railTop + p * length;
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
    // The rail is measured from real positions, so measure again whenever the list changes size (web fonts arriving,
    // a language switch, text wrapping differently) and once the fonts are ready.
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    observer?.observe(el);
    el.querySelectorAll(".flow-item").forEach((item) => observer?.observe(item));
    void document.fonts?.ready.then(schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer?.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [count]);

  return { ref, reached };
}
