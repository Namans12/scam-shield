import { useRef } from "react";
import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  id: T;
  label: string;
  /** Accessible name when the visible label is terse (e.g. "हिं"). */
  ariaLabel?: string;
  lang?: string;
}

interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (id: T) => void;
  "aria-label"?: string;
  className?: string;
}

/**
 * A single-choice control: one track and one indicator that slides to the
 * chosen segment. The indicator follows the segment's measured box, so
 * segments of different widths stay aligned. Exposed as a radio group.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  "aria-label": ariaLabel,
}: SegmentedProps<T>) {
  const segmentRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const activeIndex = Math.max(
    0,
    options.findIndex((o) => o.id === value),
  );

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("relative isolate grid h-12 shrink-0 items-center rounded-xl bg-secondary p-0.5", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {/* Equal columns and a percentage-based indicator: the pill always exactly covers the chosen segment, whatever font the label uses. */}
      <span
        aria-hidden
        className="segmented-indicator absolute inset-y-0.5 left-0.5 -z-10 rounded-lg bg-primary shadow-sm"
        style={{
          width: `calc((100% - 4px) / ${options.length})`,
          transform: `translateX(${activeIndex * 100}%)`,
        }}
      />
      {options.map((opt, i) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            ref={(el) => {
              segmentRefs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onKeyDown={(event) => {
              const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
              if (!direction && event.key !== "Home" && event.key !== "End") return;
              event.preventDefault();
              const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : (i + direction + options.length) % options.length;
              const option = options[next];
              if (option) onChange(option.id);
              segmentRefs.current[next]?.focus();
            }}
            aria-label={opt.ariaLabel}
            lang={opt.lang}
            onClick={() => onChange(opt.id)}
            className={cn(
              "segmented-option relative z-10 inline-flex h-full min-w-11 items-center justify-center whitespace-nowrap rounded-lg px-3 text-base font-semibold leading-none transition-colors duration-200",
              active ? "text-primary-foreground" : "text-secondary-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
