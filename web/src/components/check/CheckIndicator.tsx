import { ShieldMark } from "@/components/brand/ShieldMark";

/** A calm activity indicator: only the actual upload/check state is described. */
export function CheckIndicator({ text, note }: { text: string; note?: string }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
      <span aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-card shadow-sm motion-safe:animate-pulse">
        <ShieldMark size={44} />
      </span>
      <div className="min-w-0">
        <p className="text-lg font-semibold leading-relaxed">{text}</p>
        {note && <p className="mt-1 text-base leading-relaxed text-muted-foreground">{note}</p>}
      </div>
    </div>
  );
}
