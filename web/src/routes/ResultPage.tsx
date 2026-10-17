import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { FileText, Flag, ArrowLeft, AudioLines } from "lucide-react";
import type { CheckResult } from "@scam-shield/shared";
import { Button } from "@/components/ui/button";
import { VerdictBanner } from "@/components/VerdictBanner";
import { RiskMeter } from "@/components/RiskMeter";
import { RedFlagList } from "@/components/RedFlagList";
import { EntityHits } from "@/components/EntityHits";
import { LinkScanCard } from "@/components/LinkScanCard";
import { Disclaimer } from "@/components/Disclaimer";
import { QrCard } from "@/components/QrCard";
import { ReportDialog } from "@/components/ReportDialog";
import { CheckIndicator } from "@/components/check/CheckIndicator";
import { ShareWarning } from "@/components/ShareWarning";
import { scamTypeKey, useLang, useT } from "@/i18n";
import { fetchCheck } from "@/data";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-9">
      <h2 className="mb-4 text-xl font-bold leading-relaxed tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

/** The result is passed in router state by CheckPage. */
function resultFromState(state: unknown, id: string | undefined): CheckResult | null {
  if (!state || typeof state !== "object") return null;
  const result = (state as { result?: CheckResult }).result;
  if (!result || typeof result !== "object" || result.id !== id) return null;
  return result;
}

function ResultGone() {
  const t = useT();
  return (
    <div className="rounded-2xl border border-border bg-card p-6 text-center">
      <h1 className="text-2xl font-bold">{t("result.gone.title")}</h1>
      <p className="mt-2 text-base text-muted-foreground">{t("result.gone.body")}</p>
      <Button asChild size="lg" className="mt-6">
        <Link to="/check">{t("result.gone.cta")}</Link>
      </Button>
    </div>
  );
}

export default function ResultPage() {
  const { id } = useParams();
  const location = useLocation();
  const t = useT();
  const { lang } = useLang();

  // The result usually arrives in router state; opened from History or a reload, it is read from Firestore.
  const stateResult = resultFromState(location.state, id);
  const [fetched, setFetched] = useState<{ id: string; result: CheckResult | null } | null>(null);
  useEffect(() => {
    if (stateResult || !id) return;
    let live = true;
    fetchCheck(id).then(
      (r) => live && setFetched({ id, result: r }),
      () => live && setFetched({ id, result: null }),
    );
    return () => {
      live = false;
    };
  }, [id, stateResult]);
  const loading = !stateResult && !!id && !(fetched && fetched.id === id);
  const result = stateResult ?? (fetched && fetched.id === id ? fetched.result : null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const shownId = result?.id;
  useEffect(() => {
    // After navigating here, announce the verdict to screen readers.
    if (shownId) headingRef.current?.focus();
  }, [shownId]);

  if (loading) {
    return (
      <div role="status" aria-live="polite"><CheckIndicator text={t("result.loading")} /></div>
    );
  }
  if (!result) return <ResultGone />;

  return (
    <article className={result.verdict !== "no_signs" ? "pb-32 md:pb-0" : undefined}>
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <VerdictBanner verdict={result.verdict} lang={lang} headingRef={headingRef} className="rounded-none border-x-0 border-t-0" />

        <div className="p-5 sm:p-7">
          <RiskMeter score={result.risk_score} verdict={result.verdict} />
        </div>

        {result.scam_type !== "none" && (
          <p className="mx-5 mb-5 flex flex-wrap items-center gap-2 text-base sm:mx-7">
            <span className="text-muted-foreground">{t("result.scamType")}</span>
            <strong className="rounded-lg bg-secondary px-3 py-1.5 font-semibold">{t(scamTypeKey(result.scam_type))}</strong>
          </p>
        )}

        <section className="border-t border-border p-5 sm:p-7">
          <h2 className="mb-2 text-base font-semibold text-muted-foreground">{t("result.summary")}</h2>
          <p lang={result.language} className="text-lg leading-relaxed break-anywhere">{result.summary}</p>
        </section>
      </div>
      <div className="mt-5"><Disclaimer /></div>

      {result.inputKind === "audio" && result.transcript && (
        <details className="mt-6 rounded-2xl border border-border bg-card p-5">
          <summary className="min-h-11 cursor-pointer content-center text-lg font-semibold"><AudioLines size={20} className="mr-2 inline text-primary" aria-hidden />{t("result.transcript")}</summary>
          <p lang={result.language} className="mt-3 text-base leading-relaxed break-anywhere whitespace-pre-wrap">
            {result.transcript}
          </p>
        </details>
      )}

      <Section title={t("result.redFlags")}>
        <RedFlagList flags={result.red_flags} lang={result.language} />
      </Section>

      {result.next_steps.length > 0 && (
        <Section title={t("result.nextSteps")}>
          <ol role="list" className="flex flex-col gap-3">
            {result.next_steps.map((step, i) => (
              <li key={i} lang={result.language} className="flex items-start gap-4 rounded-2xl border border-border bg-card p-4 text-lg leading-relaxed break-anywhere sm:p-5">
                <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-bold tabular-nums text-primary">{i + 1}</span>
                <span className="min-w-0 pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {result.hits.length > 0 && (
        <Section title={t("hits.title")}>
          <EntityHits hits={result.hits} />
        </Section>
      )}

      {result.linkScan && (
        <Section title={t("linkscan.title")}>
          <LinkScanCard scan={result.linkScan} />
        </Section>
      )}

      {result.qr && (
        <Section title={t("qr.title")}>
          <QrCard qr={result.qr} />
        </Section>
      )}

      {result.verdict !== "no_signs" && (
        <div role="group" aria-label={t("pages.result.actions")} className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-center gap-1.5 border-t border-border bg-card/95 px-3 pt-3 pb-5 shadow-lg backdrop-blur-md md:static md:mt-8 md:flex-wrap md:justify-start md:gap-3 md:rounded-2xl md:border md:p-4 md:shadow-sm">
          {result.entityKeys.length > 0 && (
            <Button variant="outline" aria-label={t("action.report")} className="min-h-14 min-w-0 flex-1 flex-col gap-1 border-0 px-2 text-base md:flex-none text-primary md:flex-row md:border md:bg-primary md:px-4 md:text-primary-foreground" onClick={() => setReportOpen(true)}>
              <Flag aria-hidden />
              <span className="md:hidden">{t("pages.action.report")}</span><span className="hidden md:inline">{t("action.report")}</span>
            </Button>
          )}
          <Button asChild variant="outline" className="min-h-14 min-w-0 flex-1 flex-col gap-1 border-0 px-2 text-base md:flex-none md:flex-row md:border md:px-4">
            <Link to={`/complaint/${result.id}`} state={{ result }} aria-label={t("action.complaint")}>
              <FileText aria-hidden />
              <span className="md:hidden">{t("pages.action.complaint")}</span><span className="hidden md:inline">{t("action.complaint")}</span>
            </Link>
          </Button>
          <ShareWarning result={result} compact />
        </div>
      )}
      {result.verdict !== "no_signs" && result.entityKeys.length > 0 && (
        <ReportDialog result={result} open={reportOpen} onOpenChange={setReportOpen} />
      )}

      <div className="mt-6">
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link to="/check"><ArrowLeft aria-hidden />{t("result.checkAnother")}</Link>
        </Button>
      </div>
    </article>
  );
}
