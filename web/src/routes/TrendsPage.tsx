import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { ScamType } from "@scam-shield/shared";
import { Button } from "@/components/ui/button";
import { fetchTrends, summariseTrends, type Trends } from "@/data";
import { scamTypeKey, useT, type MessageKey } from "@/i18n";


function Bars({ rows, label }: { rows: Array<{ key: string; count: number }>; label: (key: string) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="flex items-baseline justify-between gap-3 text-base">
            <span className="font-medium">{label(r.key)}</span>
            <span className="tabular-nums text-muted-foreground">{r.count}</span>
          </div>
          <div className="mt-1 h-3 rounded-full bg-secondary" role="presentation">
            <div className="h-3 rounded-full bg-primary" style={{ width: `${Math.max(4, (r.count / max) * 100)}%` }} />
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
      <h1 className="text-3xl font-bold leading-tight">{t("trends.title")}</h1>
      <p className="mt-2 text-lg text-muted-foreground">{t("trends.subtitle")}</p>

      <div role="status" aria-live="polite">
        {!data && !failed && (
          <p className="mt-6 flex items-center gap-3 text-base">
            <Loader2 className="animate-spin text-primary" aria-hidden />
            {t("trends.loading")}
          </p>
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
            <p className="mt-6 text-2xl font-bold">{t("trends.total", { n: summary.total })}</p>

            <section className="mt-6" aria-labelledby="trends-type">
              <h2 id="trends-type" className="mb-3 text-xl font-bold">{t("trends.byType")}</h2>
              <Bars rows={summary.byType} label={typeLabel} />
            </section>

            {summary.byState.length > 0 && (
              <section className="mt-8" aria-labelledby="trends-state">
                <h2 id="trends-state" className="mb-3 text-xl font-bold">{t("trends.byState")}</h2>
                <Bars rows={summary.byState} label={(k) => k} />
              </section>
            )}

            {data.recent.length > 0 && (
              <section className="mt-8" aria-labelledby="trends-recent">
                <h2 id="trends-recent" className="mb-3 text-xl font-bold">{t("trends.recent")}</h2>
                <ul className="flex flex-col gap-3">
                  {data.recent.map((r) => (
                    <li key={`${r.type}:${r.masked}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-4">
                      <span>
                        <span className="font-mono text-base font-medium break-anywhere">{r.masked}</span>
                        <span className="ml-2 text-sm text-muted-foreground">{typeLabel(r.scamType)}</span>
                      </span>
                      <span className="rounded-full bg-suspicious-bg px-3 py-1 text-sm font-semibold text-suspicious-fg">
                        {r.reportCount === 1 ? t("hits.reportedOne") : t("hits.reportedMany", { n: r.reportCount })}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <p className="mt-8 text-sm text-muted-foreground">{t("trends.demoNote")}</p>
          </>
        )
      )}
    </div>
  );
}
