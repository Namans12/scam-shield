import { useId } from "react";
import type { Verdict } from "@scam-shield/shared";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";

const FILL: Record<Verdict, string> = {
  scam: "bg-scam",
  suspicious: "bg-suspicious",
  no_signs: "bg-nosigns",
};

const METER_MOTION = `
  @keyframes scamshield-meter-fill {
    from { transform: scaleX(0); }
    to { transform: scaleX(1); }
  }
  .scamshield-meter-fill {
    transform-origin: left;
    animation: scamshield-meter-fill 900ms cubic-bezier(.2,0,0,1) both;
  }
  @media (prefers-reduced-motion: reduce) {
    .scamshield-meter-fill { animation: none; }
  }
`;

/** Horizontal meter for the 0-100 risk score. The number is always shown as text too. */
export function RiskMeter({ score, verdict }: { score: number; verdict: Verdict }) {
  const t = useT();
  const labelId = useId();
  const value = Math.max(0, Math.min(100, Math.round(score)));
  const label = t("result.riskScore");
  return (
    <div>
      <style>{METER_MOTION}</style>
      <div className="flex items-baseline justify-between gap-3">
        <span id={labelId} className="text-base font-semibold">
          {label}
        </span>
        <span className="text-base text-muted-foreground" aria-label={t("result.riskOutOf", { score: value })}>
          <strong className="text-3xl font-bold tracking-tight text-foreground">{value}</strong>
          <span aria-hidden="true"> / 100</span>
        </span>
      </div>
      <div
        role="meter"
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-secondary"
      >
        <div className={cn("scamshield-meter-fill h-full rounded-full", FILL[verdict])} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
