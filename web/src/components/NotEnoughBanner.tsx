import { Info } from "lucide-react";
import { LangText } from "@/components/landing/LangStack";
import { useT } from "@/i18n";

/**
 * Shown instead of the "No scam signs found" banner when the input had too little in it to judge (see lib/judgeable).
 * Neutral on purpose, like that banner: an info icon, never a tick, and no score.
 */
export function NotEnoughBanner({ headingRef }: { headingRef?: React.Ref<HTMLHeadingElement> }) {
  const t = useT();
  return (
    <section data-verdict="unclear" className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-4 rounded-none border border-x-0 border-t-0 border-l-4 border-nosigns bg-nosigns-bg p-5 text-nosigns-fg sm:gap-x-5 sm:p-7">
      <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-current/15 bg-card/40 sm:size-16"><Info size={32} aria-hidden /></span>
      <div className="min-w-0">
        <p className="mb-2 text-base font-medium">{t("pages.result.eyebrow")}</p>
        <h1 ref={headingRef} tabIndex={-1} className="scroll-mt-24 text-3xl font-bold leading-tight tracking-tight focus:outline-none sm:text-4xl"><LangText k="result.unclear.title" /></h1>
      </div>
      <p className="col-span-2 max-w-xl text-lg leading-relaxed"><LangText k="result.unclear.body" /></p>
    </section>
  );
}
