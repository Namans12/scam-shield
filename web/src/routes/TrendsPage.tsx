import { useCallback, useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";
import type { ScamType } from "@scam-shield/shared";
import { CheckIndicator } from "@/components/check/CheckIndicator";
import { Button } from "@/components/ui/button";
import { fetchTrends, summariseTrends, type Trends } from "@/data";
import { scamTypeKey, useT, type MessageKey } from "@/i18n";

function Bars({ rows, label }: { rows: Array<{ key: string; count: number }>; label: (key: string) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="flex flex-col gap-5">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="flex items-baseline justify-between gap-3 text-base">
            <span className="font-medium">{label(r.key)}</span>
            <span className="tabular-nums text-muted-foreground">{r.count}</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-secondary" role="presentation">
            <div className="h-2 rounded-full bg-primary" style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function TrendsPage() {
  const t = useT();
  const [data, setData] = useState<Trends | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    setData(null);
    fetchTrends().then(setData, () => setFailed(true));
  }, []);
  useEffect(load, [load]);

  const summary = data ? summariseTrends(data.days) : null;
  const typeLabel = (k: string) => {
    const key = scamTypeKey(k as ScamType);
    return t(key as MessageKey) === key ? k.replace(/_/g, " ") : t(key as MessageKey);
  };

  return (
    <div>
      <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{t("trends.title")}</h1>
      <p className="mt-3 text-lg leading-relaxed text-muted-foreground">{t("trends.subtitle")}</p>

      <div role="status" aria-live="polite">
        {!data && !failed && (
          <div className="mt-6"><CheckIndicator text={t("trends.loading")} /></div>
        )}
      </div>

      {failed && (
        <div role="alert" className="mt-6 rounded-xl border-l-8 border-scam bg-scam-bg p-4 text-scam-fg">
          <p className="text-base">{t("trends.error")}</p>
          <Button variant="outline" className="mt-3" onClick={load}>
            {t("trends.retry")}
          </Button>
        </div>
      )}

      {data && summary && (
        summary.total === 0 ? (
          <p className="mt-6 text-lg">{t("trends.empty")}</p>
        ) : (
          <>
            <div className="mt-7 rounded-3xl border border-primary/20 bg-primary/5 p-6 sm:p-7">
              <BarChart3 size={28} className="mb-5 text-primary" aria-hidden />
              <p className="text-base font-medium text-muted-foreground">{t("pages.trends.period")}</p>
              <p className="mt-2 text-3xl font-bold leading-snug tracking-tight">{t("trends.total", { n: summary.total })}</p>
              <p className="mt-4 text-base text-muted-foreground">{t("trends.demoNote")}</p>
            </div>
            <div className="mt-5 grid items-start gap-5 lg:grid-cols-2">

              <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6" aria-labelledby="trends-type">
                <h2 id="trends-type" className="mb-5 text-xl font-bold tracking-tight">{t("trends.byType")}</h2>
                <Bars rows={summary.byType} label={typeLabel} />
              </section>

              {summary.byState.length > 0 && (
                <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6" aria-labelledby="trends-state">
                  <h2 id="trends-state" className="mb-5 text-xl font-bold tracking-tight">{t("trends.byState")}</h2>
                  <Bars rows={summary.byState} label={(k) => k} />
                </section>
              )}

            </div>
            {data.recent.length > 0 && (
              <section className="mt-8" aria-labelledby="trends-recent">
                <h2 id="trends-recent" className="mb-5 text-xl font-bold tracking-tight">{t("trends.recent")}</h2>
                <ul className="flex flex-col gap-3">
                  {data.recent.map((r) => (
                    <li key={`${r.type}:${r.masked}`} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card p-5">
                      <span>
                        <span className="font-mono text-base font-medium break-anywhere">{r.masked}</span>
                        <span className="mt-1 block text-base text-muted-foreground">{typeLabel(r.scamType)}</span>
                      </span>
                      <span className="rounded-full bg-suspicious-bg px-3 py-1 text-sm font-semibold text-suspicious-fg">
                        {r.reportCount === 1 ? t("hits.reportedOne") : t("hits.reportedMany", { n: r.reportCount })}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

          </>
        )
      )}
    </div>
  );
}
