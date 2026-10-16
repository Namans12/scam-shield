import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { FileText, Flag, Loader2 } from "lucide-react";
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
import { ShareWarning } from "@/components/ShareWarning";
import { scamTypeKey, useLang, useT } from "@/i18n";
import { fetchCheck } from "@/data";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-xl font-bold leading-snug">{title}</h2>
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
        <Link to="/">{t("result.gone.cta")}</Link>
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
      <p role="status" className="flex items-center gap-3 text-base">
        <Loader2 className="animate-spin text-primary" aria-hidden />
        {t("result.loading")}
      </p>
    );
  }
  if (!result) return <ResultGone />;

  return (
    <article>
      <VerdictBanner verdict={result.verdict} lang={lang} headingRef={headingRef} />

      <div className="mt-6">
        <RiskMeter score={result.risk_score} verdict={result.verdict} />
      </div>

      {result.scam_type !== "none" && (
        <p className="mt-5 text-base">
          <span className="text-muted-foreground">{t("result.scamType")}: </span>
          <strong>{t(scamTypeKey(result.scam_type))}</strong>
        </p>
      )}

      <Section title={t("result.summary")}>
        <p lang={result.language} className="text-lg leading-relaxed break-anywhere">
          {result.summary}
        </p>
      </Section>

      {result.inputKind === "audio" && result.transcript && (
        <details className="mt-6 rounded-xl border border-border bg-card p-4">
          <summary className="cursor-pointer text-base font-semibold">{t("result.transcript")}</summary>
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
          <ol className="flex list-decimal flex-col gap-2 pl-6 text-lg marker:font-bold marker:text-primary">
            {result.next_steps.map((step, i) => (
              <li key={i} lang={result.language} className="pl-1 break-anywhere">
                {step}
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
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {result.entityKeys.length > 0 && (
            <Button variant="outline" onClick={() => setReportOpen(true)}>
              <Flag aria-hidden />
              {t("action.report")}
            </Button>
          )}
          <Button asChild variant="outline">
            <Link to={`/complaint/${result.id}`} state={{ result }}>
              <FileText aria-hidden />
              {t("action.complaint")}
            </Link>
          </Button>
          <ShareWarning result={result} />
        </div>
      )}
      {result.verdict !== "no_signs" && result.entityKeys.length > 0 && (
        <ReportDialog result={result} open={reportOpen} onOpenChange={setReportOpen} />
      )}

      <div className="mt-8">
        <Disclaimer />
      </div>

      <div className="mt-6">
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link to="/">{t("result.checkAnother")}</Link>
        </Button>
      </div>
    </article>
  );
}
