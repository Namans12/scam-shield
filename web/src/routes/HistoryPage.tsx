import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Clock3, Info, OctagonAlert, TriangleAlert } from "lucide-react";
import type { CheckResult } from "@scam-shield/shared";
import { CheckIndicator } from "@/components/check/CheckIndicator";
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
      <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{t("history.title")}</h1>
      <p className="mt-3 text-lg leading-relaxed text-muted-foreground">{t("history.subtitle")}</p>

      <div role="status" aria-live="polite">
        {!items && !failed && (
          <div className="mt-6"><CheckIndicator text={t("trends.loading")} /></div>
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
        <div className="mt-7 rounded-3xl border border-border bg-card p-7 text-center">
          <Clock3 size={36} className="mx-auto mb-4 text-primary" aria-hidden /><p className="text-lg">{t("history.empty")}</p>
          <Button asChild size="lg" className="mt-4">
            <Link to="/check">{t("about.cta")}</Link>
          </Button>
        </div>
      )}

      {items && items.length > 0 && (
        <ul className="mt-7 flex flex-col gap-4">
          {items.map((c) => (
            <li key={c.id}>
              <Link
                to={`/result/${c.id}`}
                state={{ result: c }}
                className="group block rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/50 hover:bg-primary/5 sm:p-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-base font-semibold", BADGE[c.verdict])}>{c.verdict === "scam" ? <OctagonAlert size={16} aria-hidden /> : c.verdict === "suspicious" ? <TriangleAlert size={16} aria-hidden /> : <Info size={16} aria-hidden />}{t(`verdict.${c.verdict}`)}</span>
                  <time dateTime={c.createdAt} className="text-sm text-muted-foreground">{when(c.createdAt)}</time>
                </div>
                {c.scam_type !== "none" && <p className="mt-4 text-lg font-semibold">{t(scamTypeKey(c.scam_type))}</p>}
                <p lang={c.language} className="mt-2 line-clamp-2 text-base leading-relaxed text-muted-foreground break-anywhere">{c.summary}</p>
                <span aria-hidden="true" className="mt-4 flex justify-end text-primary"><ArrowUpRight size={20} /></span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-7 rounded-2xl border border-border bg-secondary/40 p-4 text-base leading-relaxed text-muted-foreground">{t("history.note")}</p>
    </div>
  );
}
