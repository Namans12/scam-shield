import { AtSign, Globe, Landmark, Phone } from "lucide-react";
import { maskIdentifier } from "@scam-shield/shared/mask";
import type { EntityHit, EntityKey } from "@scam-shield/shared";
import { scamTypeKey, useT } from "@/i18n";

function KindIcon({ k }: { k: EntityKey }) {
  const props = { size: 18, "aria-hidden": true, className: "shrink-0 text-muted-foreground" } as const;
  if (k.startsWith("phone:")) return <Phone {...props} />;
  if (k.startsWith("upi:")) return <AtSign {...props} />;
  if (k.startsWith("domain:")) return <Globe {...props} />;
  return <Landmark {...props} />;
}

function Identifier({ k }: { k: EntityKey }) {
  return (
    <span className="inline-flex items-center gap-2">
      <KindIcon k={k} />
      <span className="font-mono text-base font-medium break-anywhere">{maskIdentifier(k)}</span>
    </span>
  );
}

/**
 * Scam-list hits. Wording is always "Reported N times" (never "confirmed"), and
 * phone/UPI/account identifiers are masked before they reach the screen.
 */
export function EntityHits({ hits }: { hits: EntityHit[] }) {
  const t = useT();
  if (hits.length === 0) return null;

  return (
    <div>
      <ul className="flex flex-col gap-3">
        {hits.map((h) => (
          <li key={h.key} className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Identifier k={h.key} />
              <span className="rounded-full bg-suspicious-bg px-3 py-1 text-sm font-semibold text-suspicious-fg">
                {h.reportCount === 1 ? t("hits.reportedOne") : t("hits.reportedMany", { n: h.reportCount })}
              </span>
            </div>
            {h.scamTypes.filter((s) => s !== "none").length > 0 && (
              <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                {h.scamTypes
                  .filter((s) => s !== "none")
                  .map((s) => t(scamTypeKey(s)))
                  .join(", ")}
              </p>
            )}
            {h.linked.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium text-muted-foreground">{t("hits.linked")}</p>
                <ul className="mt-1 flex flex-col gap-1">
                  {h.linked.map((l) => (
                    <li key={l}>
                      <Identifier k={l} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">{t("hits.note")}</p>
    </div>
  );
}
