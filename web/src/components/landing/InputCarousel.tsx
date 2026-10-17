import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";

export interface CarouselItem {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  visual: ReactNode;
}

/**
 * Swipeable card carousel (native scroll-snap, so touch, trackpad and keyboard scrolling all work) with
 * previous/next buttons, dots, arrow-key support and mouse drag. It never moves on its own.
 */
export function InputCarousel({ items, labelledBy }: { items: readonly CarouselItem[]; labelledBy: string }) {
  const t = useT();
  const track = useRef<HTMLDivElement>(null);
  const slides = useRef<(HTMLElement | null)[]>([]);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const [current, setCurrent] = useState(0);

  const sync = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const middle = el.scrollLeft + el.clientWidth / 2;
    let best = 0;
    let bestDistance = Infinity;
    slides.current.forEach((slide, i) => {
      if (!slide) return;
      const distance = Math.abs(slide.offsetLeft + slide.offsetWidth / 2 - middle);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    });
    setCurrent(best);
  }, []);

  useEffect(() => {
    sync();
    const el = track.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(() => { frame = 0; sync(); });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [sync]);

  const goTo = (index: number) => {
    const el = track.current;
    const slide = slides.current[Math.max(0, Math.min(items.length - 1, index))];
    if (!el || !slide) return;
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Every slide can be centred (the track is padded), so any slide, first and last included, is always reachable.
    el.scrollTo({ left: slide.offsetLeft + slide.offsetWidth / 2 - el.clientWidth / 2, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <div className="input-carousel" role="region" aria-roledescription="carousel" aria-labelledby={labelledBy} data-start={current === 0} data-end={current === items.length - 1}>
      <div
        ref={track}
        className="carousel-track"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") { event.preventDefault(); goTo(current + 1); }
          if (event.key === "ArrowLeft") { event.preventDefault(); goTo(current - 1); }
        }}
        onPointerDown={(event) => {
          if (event.pointerType !== "mouse" || event.button !== 0 || !track.current) return;
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
          <button type="button" className={cn("carousel-arrow")} aria-label={t("landing.carouselPrev")} disabled={current === 0} onClick={() => goTo(current - 1)}><ChevronLeft size={22} aria-hidden /></button>
          <button type="button" className={cn("carousel-arrow")} aria-label={t("landing.carouselNext")} disabled={current === items.length - 1} onClick={() => goTo(current + 1)}><ChevronRight size={22} aria-hidden /></button>
        </div>
      </div>
    </div>
  );
}
