import { useEffect, useRef } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { FileText, Flag, Share2 } from "lucide-react";
import type { CheckResult } from "@scam-shield/shared";
import { Button } from "@/components/ui/button";
import { VerdictBanner } from "@/components/VerdictBanner";
import { RiskMeter } from "@/components/RiskMeter";
import { RedFlagList } from "@/components/RedFlagList";
import { EntityHits } from "@/components/EntityHits";
import { LinkScanCard } from "@/components/LinkScanCard";
import { Disclaimer } from "@/components/Disclaimer";
import { scamTypeKey, useLang, useT } from "@/i18n";

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

  // A Firestore read for results that are not in router state comes in a later task.
  const result = resultFromState(location.state, id);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shownId = result?.id;
  useEffect(() => {
    // After navigating here, announce the verdict to screen readers.
    if (shownId) headingRef.current?.focus();
  }, [shownId]);

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
          <div className="rounded-xl border border-border bg-card p-4 text-base">
            <p>{t("qr.found")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("qr.soon")}</p>
          </div>
        </Section>
      )}

      {/* Wired up in a later task (report, complaint draft, share). */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button variant="outline" disabled title={t("action.soon")}>
          <Flag />
          {t("action.report")}
        </Button>
        <Button variant="outline" disabled title={t("action.soon")}>
          <FileText />
          {t("action.complaint")}
        </Button>
        <Button variant="outline" disabled title={t("action.soon")}>
          <Share2 />
          {t("action.share")}
        </Button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{t("action.soon")}</p>

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
