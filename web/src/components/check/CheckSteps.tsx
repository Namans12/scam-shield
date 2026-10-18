import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { LangText } from "@/components/landing/LangStack";
import { useT, type MessageKey } from "@/i18n";
import { cn } from "@/lib/utils";

interface Step { key: MessageKey; /** Milliseconds after the check starts when this step becomes the current one. */ at: number }

// Indicative only: real checks take 5-25 s and the server does not report its progress. The last step stays current
// until the answer arrives, so nothing here ever claims to be finished.
const STEPS: Step[] = [
  { key: "check.step.read", at: 0 },
  { key: "check.step.list", at: 2_500 },
  { key: "check.step.link", at: 5_000 },
  { key: "check.step.write", at: 14_000 },
];
// Without a link there is no scan, so the explanation starts sooner.
const STEPS_NO_LINK: Step[] = [
  { key: "check.step.read", at: 0 },
  { key: "check.step.list", at: 2_500 },
  { key: "check.step.write", at: 6_000 },
];

/**
 * The steps of a check, shown in order while waiting. Deliberately NOT inside the live region: the page announces the
 * "Checking…" line once, and a list that changes every few seconds would be read out again and again. No percent, no
 * bar; the only motion is a soft pulse that prefers-reduced-motion switches off.
 */
export function CheckSteps({ hasLink }: { hasLink: boolean }) {
  const t = useT();
  const steps = hasLink ? STEPS : STEPS_NO_LINK;
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    setCurrent(0);
    const timers = steps.slice(1).map((s, i) => setTimeout(() => setCurrent(i + 1), s.at));
    return () => timers.forEach(clearTimeout);
  }, [steps]);

  return (
    <div className="mt-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <ol aria-label={t("check.steps.label")} className="flex flex-col gap-2.5">
        {steps.map((s, i) => {
          const state = i < current ? "done" : i === current ? "now" : "next";
          return (
            <li key={s.key} aria-current={state === "now" ? "step" : undefined} data-state={state} className="flex items-start gap-3">
              <span aria-hidden="true" className="mt-1 flex size-5 shrink-0 items-center justify-center">
                {state === "done" ? (
                  <Check size={18} className="text-primary" />
                ) : (
                  <span className={cn("size-3 rounded-full", state === "now" ? "bg-primary motion-safe:animate-pulse" : "border-2 border-muted-foreground/50")} />
                )}
              </span>
              <span className={cn("min-w-0 text-base leading-relaxed", state === "now" ? "font-semibold" : state === "next" ? "text-muted-foreground" : "")}>
                <LangText k={s.key} />
                {state !== "next" && <span className="sr-only"> ({t(state === "done" ? "check.step.done" : "check.step.now")})</span>}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground"><LangText k="check.steps.note" /></p>
    </div>
  );
}
