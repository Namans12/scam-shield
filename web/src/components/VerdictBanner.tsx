import { Info, OctagonAlert, TriangleAlert } from "lucide-react";
import type { Lang, Verdict } from "@scam-shield/shared";
import { translate, type MessageKey } from "@/i18n";
import { cn } from "@/lib/utils";

// Each verdict has its own bg/fg pair. All are at least WCAG AA (see index.css).
// "no_signs" gets a neutral info icon on purpose: it is never a tick or a shield,
// because "nothing found" is not "safe".
const STYLES: Record<Verdict, { box: string; icon: React.ReactNode; label: MessageKey; desc: MessageKey }> = {
  scam: {
    box: "border-scam bg-scam-bg text-scam-fg",
    icon: <OctagonAlert size={32} aria-hidden />,
    label: "verdict.scam",
    desc: "verdict.scam.desc",
  },
  suspicious: {
    box: "border-suspicious bg-suspicious-bg text-suspicious-fg",
    icon: <TriangleAlert size={32} aria-hidden />,
    label: "verdict.suspicious",
    desc: "verdict.suspicious.desc",
  },
  no_signs: {
    box: "border-nosigns bg-nosigns-bg text-nosigns-fg",
    icon: <Info size={32} aria-hidden />,
    label: "verdict.no_signs",
    desc: "verdict.no_signs.desc",
  },
};

export function VerdictBanner({
  verdict,
  lang,
  className,
  headingRef,
}: {
  verdict: Verdict;
  lang: Lang;
  className?: string;
  /** Lets the page move focus here after navigating, so screen readers announce the verdict. */
  headingRef?: React.Ref<HTMLHeadingElement>;
}) {
  const s = STYLES[verdict];
  return (
    <section
      data-verdict={verdict}
      className={cn("grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-4 rounded-3xl border border-l-4 p-5 sm:gap-x-5 sm:p-7", s.box, className)}
    >
      <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-current/15 bg-card/40 sm:size-16">{s.icon}</span>
      <div className="min-w-0">
        <p className="mb-2 text-base font-medium">{translate(lang, "pages.result.eyebrow")}</p>
        <h1 ref={headingRef} tabIndex={-1} className="scroll-mt-24 text-3xl font-bold leading-tight tracking-tight focus:outline-none sm:text-4xl">{translate(lang, s.label)}</h1>
      </div>
      <p className="col-span-2 max-w-xl text-lg leading-relaxed">{translate(lang, s.desc)}</p>
    </section>
  );
}
