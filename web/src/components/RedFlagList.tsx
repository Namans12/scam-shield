import { Quote } from "lucide-react";
import type { RedFlag } from "@scam-shield/shared";
import { useT } from "@/i18n";

/**
 * Warning signs with the exact words that triggered each one. Everything here is
 * model output derived from untrusted text, so it is rendered as plain text only.
 */
export function RedFlagList({ flags }: { flags: RedFlag[] }) {
  const t = useT();

  if (flags.length === 0) {
    return <p className="text-base text-muted-foreground">{t("result.redFlags.none")}</p>;
  }

  return (
    <ul className="flex flex-col gap-4">
      {flags.map((f, i) => (
        <li key={i} className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-base font-bold leading-snug break-anywhere">{f.flag}</h3>
          {f.evidence && (
            <figure className="mt-3">
              <figcaption className="text-sm font-medium text-muted-foreground">{t("result.evidence")}</figcaption>
              <blockquote className="mt-1 flex gap-2 rounded-lg border-l-4 border-primary bg-secondary px-3 py-2 text-base italic break-anywhere">
                <Quote size={16} aria-hidden className="mt-1.5 shrink-0 text-muted-foreground" />
                <span>{f.evidence}</span>
              </blockquote>
            </figure>
          )}
          {f.why_it_matters && <p className="mt-3 text-base break-anywhere">{f.why_it_matters}</p>}
        </li>
      ))}
    </ul>
  );
}
