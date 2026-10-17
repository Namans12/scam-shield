import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useT } from "@/i18n";

export interface CarouselItem {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  visual: ReactNode;
}

/** How long the track must be still before a programmatic scroll is considered finished. */
const SETTLE_MS = 160;

/**
 * Card carousel: native scroll-snap (so touch, trackpad and keyboard scrolling all work) with previous/next buttons,
 * dots, arrow keys and mouse drag. It never moves on its own.
 *
 * The layout is edge-aware: the first card sits at the start of the track and the last card at its end, so the row is
 * always full. The highlighted card is an explicit `current` index. Buttons, dots, keys and clicks set it directly (a card
 * near the end cannot always reach the start edge, so the scroll position alone could never express it); when the user
 * scrolls or swipes, it follows the card that is most in view, and the track's start and end always mean the first and
 * last card.
 */
export function InputCarousel({ items, labelledBy }: { items: readonly CarouselItem[]; labelledBy: string }) {
  const t = useT();
  const track = useRef<HTMLDivElement>(null);
  const slides = useRef<(HTMLElement | null)[]>([]);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const settleTimer = useRef(0);
  const programmatic = useRef(false);
  const [current, setCurrent] = useState(0);
  const last = items.length - 1;

  const maxScroll = (el: HTMLElement) => Math.max(0, el.scrollWidth - el.clientWidth);

  /** Scroll offset that puts card `index` at the start of the track, limited to what the track can actually scroll. */
  const targetFor = useCallback((index: number) => {
    const el = track.current;
    const slide = slides.current[index];
    if (!el || !slide) return 0;
    const padding = parseFloat(getComputedStyle(el).scrollPaddingInlineStart) || parseFloat(getComputedStyle(el).paddingLeft) || 0;
    return Math.max(0, Math.min(maxScroll(el), slide.offsetLeft - padding));
  }, []);

  const release = useCallback(() => {
    window.clearTimeout(settleTimer.current);
    settleTimer.current = 0;
    programmatic.current = false;
  }, []);

  /** The user scrolled: the card most in view becomes the active one. */
  const sync = useCallback(() => {
    const el = track.current;
    if (!el || programmatic.current) return;
    const max = maxScroll(el);
    if (max <= 0) return;
    let best = 0;
    if (el.scrollLeft <= 1) best = 0;
    else if (el.scrollLeft >= max - 1) best = last;
    else {
      let distance = Infinity;
      for (let i = 0; i <= last; i += 1) {
        const d = Math.abs(targetFor(i) - el.scrollLeft);
        if (d < distance - 0.5) { distance = d; best = i; }
      }
    }
    setCurrent(best);
  }, [last, targetFor]);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      if (programmatic.current) {
        // A programmatic scroll is under way: keep the chosen card, and finish once the track has been still for a moment.
        window.clearTimeout(settleTimer.current);
        settleTimer.current = window.setTimeout(release, SETTLE_MS);
        return;
      }
      if (!frame) frame = window.requestAnimationFrame(() => { frame = 0; sync(); });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("scrollend", release);
    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("scrollend", release);
      if (frame) window.cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer.current);
    };
  }, [sync, release]);

  const scrollToLeft = useCallback((left: number, smooth: boolean) => {
    const el = track.current;
    if (!el) return;
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (Math.abs(left - el.scrollLeft) < 1) { release(); return; }
    programmatic.current = true;
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(release, 400);
    if (typeof el.scrollTo === "function") el.scrollTo({ left, behavior: smooth && !reduce ? "smooth" : "auto" });
    else el.scrollLeft = left;
  }, [release]);

  const goTo = (index: number) => {
    const next = Math.max(0, Math.min(last, index));
    setCurrent(next);
    scrollToLeft(targetFor(next), true);
  };

  // After a resize the card widths change: keep the active card in view.
  useEffect(() => {
    const onResize = () => scrollToLeft(targetFor(current), false);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [current, scrollToLeft, targetFor]);

  return (
    <div className="input-carousel" role="region" aria-roledescription="carousel" aria-labelledby={labelledBy} data-start={current === 0} data-end={current === last}>
      <div
        ref={track}
        className="carousel-track"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") { event.preventDefault(); goTo(current + 1); }
          else if (event.key === "ArrowLeft") { event.preventDefault(); goTo(current - 1); }
          else if (event.key === "Home") { event.preventDefault(); goTo(0); }
          else if (event.key === "End") { event.preventDefault(); goTo(last); }
        }}
        onWheel={release}
        onTouchStart={release}
        onClickCapture={(event) => {
          if (suppressClick.current) { suppressClick.current = false; event.stopPropagation(); }
        }}
        onPointerDown={(event) => {
          if (event.pointerType !== "mouse" || event.button !== 0 || !track.current) return;
          release();
          drag.current = { x: event.clientX, left: track.current.scrollLeft, moved: false };
        }}
        onPointerMove={(event) => {
          const d = drag.current;
          const el = track.current;
          if (!d || !el) return;
          const dx = event.clientX - d.x;
          if (!d.moved && Math.abs(dx) < 4) return;
          if (!d.moved) {
            d.moved = true;
            el.setPointerCapture(event.pointerId);
            el.classList.add("is-dragging");
          }
          el.scrollLeft = d.left - dx;
        }}
        onPointerUp={(event) => {
          const el = track.current;
          const d = drag.current;
          drag.current = null;
          if (!el || !d?.moved) return;
          el.releasePointerCapture(event.pointerId);
          el.classList.remove("is-dragging");
          suppressClick.current = true;
          window.setTimeout(() => { suppressClick.current = false; }, 0);
          sync();
        }}
        onPointerCancel={() => {
          drag.current = null;
          track.current?.classList.remove("is-dragging");
        }}
      >
        {items.map(({ id, icon: Icon, title, description, visual }, index) => (
          <article
            key={id}
            ref={(node) => { slides.current[index] = node; }}
            className="input-slide"
            role="group"
            aria-roledescription="slide"
            aria-label={t("landing.carouselPosition", { n: index + 1, total: items.length })}
            data-current={index === current}
            onClick={() => { if (index !== current) goTo(index); }}
          >
            <div className="slide-visual" aria-hidden>{visual}</div>
            <div className="slide-body">
              <span className="input-icon"><Icon size={25} strokeWidth={1.6} aria-hidden /></span>
              <h3>{title}</h3>
              <p>{description}</p>
            </div>
          </article>
        ))}
      </div>
      <div className="carousel-controls">
        <div className="carousel-dots">
          {items.map(({ id, title }, index) => (
            <button key={id} type="button" className="carousel-dot" aria-label={t("landing.carouselGoTo", { name: title })} aria-current={index === current} onClick={() => goTo(index)}>
              <span />
            </button>
          ))}
        </div>
        <div className="carousel-arrows">
          <button type="button" className="carousel-arrow" aria-label={t("landing.carouselPrev")} disabled={current === 0} onClick={() => goTo(current - 1)}><ChevronLeft size={22} aria-hidden /></button>
          <button type="button" className="carousel-arrow" aria-label={t("landing.carouselNext")} disabled={current === last} onClick={() => goTo(current + 1)}><ChevronRight size={22} aria-hidden /></button>
        </div>
      </div>
    </div>
  );
}
