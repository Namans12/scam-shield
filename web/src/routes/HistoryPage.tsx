import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import type { CheckResult } from "@scam-shield/shared";
import { Button } from "@/components/ui/button";
import { fetchHistory } from "@/data";
import { scamTypeKey, useLang, useT } from "@/i18n";
import { cn } from "@/lib/utils";

const BADGE: Record<CheckResult["verdict"], string> = {
  scam: "bg-scam-bg text-scam-fg",
  suspicious: "bg-suspicious-bg text-suspicious-fg",
  no_signs: "bg-nosigns-bg text-nosigns-fg",
};

export default function HistoryPage() {
  const t = useT();
  const { lang } = useLang();
  const [items, setItems] = useState<CheckResult[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    setItems(null);
    fetchHistory().then(setItems, () => setFailed(true));
  }, []);
  useEffect(load, [load]);

  const when = (iso: string) =>
    new Intl.DateTimeFormat(lang === "hi" ? "hi-IN" : "en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

  return (
    <div>
      <h1 className="text-3xl font-bold leading-tight">{t("history.title")}</h1>
      <p className="mt-2 text-lg text-muted-foreground">{t("history.subtitle")}</p>

      <div role="status" aria-live="polite">
        {!items && !failed && (
          <p className="mt-6 flex items-center gap-3 text-base">
            <Loader2 className="animate-spin text-primary" aria-hidden />
            {t("trends.loading")}
          </p>
        )}
      </div>

      {failed && (
        <div role="alert" className="mt-6 rounded-xl border-l-8 border-scam bg-scam-bg p-4 text-scam-fg">
          <p className="text-base">{t("history.error")}</p>
          <Button variant="outline" className="mt-3" onClick={load}>
            {t("trends.retry")}
          </Button>
        </div>
      )}

      {items && items.length === 0 && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-6">
          <p className="text-lg">{t("history.empty")}</p>
          <Button asChild size="lg" className="mt-4">
            <Link to="/">{t("about.cta")}</Link>
          </Button>
        </div>
      )}

      {items && items.length > 0 && (
        <ul className="mt-6 flex flex-col gap-3">
          {items.map((c) => (
            <li key={c.id}>
              <Link
                to={`/result/${c.id}`}
                state={{ result: c }}
                className="block rounded-xl border border-border bg-card p-4 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={cn("rounded-full px-3 py-1 text-sm font-bold", BADGE[c.verdict])}>{t(`verdict.${c.verdict}`)}</span>
                  <time dateTime={c.createdAt} className="text-sm text-muted-foreground">{when(c.createdAt)}</time>
                </div>
                {c.scam_type !== "none" && <p className="mt-2 text-base font-semibold">{t(scamTypeKey(c.scam_type))}</p>}
                <p lang={c.language} className="mt-1 line-clamp-2 text-base text-muted-foreground break-anywhere">{c.summary}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 text-sm text-muted-foreground">{t("history.note")}</p>
    </div>
  );
}
