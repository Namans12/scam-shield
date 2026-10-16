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

export function VerdictBanner({ verdict, lang, className }: { verdict: Verdict; lang: Lang; className?: string }) {
  const s = STYLES[verdict];
  return (
    <section
      data-verdict={verdict}
      className={cn("flex items-start gap-4 rounded-2xl border-l-8 p-5", s.box, className)}
    >
      <span className="mt-1 shrink-0">{s.icon}</span>
      <div className="min-w-0">
        <h1 className="text-2xl font-bold leading-tight">{translate(lang, s.label)}</h1>
        <p className="mt-1 text-base leading-snug">{translate(lang, s.desc)}</p>
      </div>
    </section>
  );
}
