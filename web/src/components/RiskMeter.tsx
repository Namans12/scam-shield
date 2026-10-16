import type { Verdict } from "@scam-shield/shared";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";

const FILL: Record<Verdict, string> = {
  scam: "bg-scam",
  suspicious: "bg-suspicious",
  no_signs: "bg-nosigns",
};

/** Horizontal meter for the 0-100 risk score. The number is always shown as text too. */
export function RiskMeter({ score, verdict }: { score: number; verdict: Verdict }) {
  const t = useT();
  const value = Math.max(0, Math.min(100, Math.round(score)));
  const label = t("result.riskScore");
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span id="risk-label" className="text-base font-semibold">
          {label}
        </span>
        <span className="text-base text-muted-foreground">{t("result.riskOutOf", { score: value })}</span>
      </div>
      <div
        role="meter"
        aria-labelledby="risk-label"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        className="mt-2 h-3 w-full overflow-hidden rounded-full bg-secondary"
      >
        <div className={cn("h-full rounded-full", FILL[verdict])} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
