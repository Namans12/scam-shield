import { Link, Navigate, useLocation } from "react-router-dom";
import { ArrowRight, ArrowUpRight, MessageSquareText, Image, QrCode, Link2, AudioLines, FileText, UsersRound, Send, ScanSearch, Eye, Route, LockKeyhole, OctagonAlert, TriangleAlert, Info } from "lucide-react";
import { useT } from "@/i18n";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { HeroPreview } from "@/components/landing/HeroPreview";
import { InputCarousel } from "@/components/landing/InputCarousel";
import { ImageVisual, LinkVisual, QrVisual, TextVisual, VoiceVisual } from "@/components/landing/InputVisuals";
import { ScrollFlow } from "@/components/landing/ScrollFlow";
import { LangStack, LangText } from "@/components/landing/LangStack";
import { CountNumber } from "@/components/landing/CountNumber";
import { BENCHMARK } from "@/benchmark";
import { translate } from "@/i18n";
import { BrandLockup } from "@/components/brand/BrandLockup";

const inputs = [
  { id: "text", icon: MessageSquareText, visual: <TextVisual /> },
  { id: "image", icon: Image, visual: <ImageVisual /> },
  { id: "qr", icon: QrCode, visual: <QrVisual /> },
  { id: "link", icon: Link2, visual: <LinkVisual /> },
  { id: "voice", icon: AudioLines, visual: <VoiceVisual /> },
] as const;
const steps = [{ id: 1, icon: ScanSearch }, { id: 2, icon: Eye }, { id: 3, icon: Route }] as const;
const actions = [{ id: "complaint", icon: FileText }, { id: "reports", icon: UsersRound }, { id: "share", icon: Send }] as const;
const cloudServices = ["Gemini", "Vertex AI", "Cloud Run", "Firestore", "Firebase"] as const;
const examples = [{ id: "kyc_sms", icon: MessageSquareText }, { id: "fake_payment", icon: Image }, { id: "qr_receive", icon: QrCode }, { id: "digital_arrest", icon: AudioLines }] as const;

// BENCHMARK.cases comes with the new benchmark values; the caption stays hidden until it exists.
const benchmarkCases = (BENCHMARK as { cases?: string }).cases;

export default function LandingPage() {
  const t = useT();
  const location = useLocation();
  if (new URLSearchParams(location.search).get("shared") === "1") {
    return <Navigate replace to={{ pathname: "/check", search: location.search, hash: location.hash }} />;
  }
  return (
    <div className="landing-page">
      <a href="#main" className="skip-link">{t("nav.skip")}</a>
      <LandingHeader />
      <main id="main">
        <section className="landing-hero" aria-labelledby="hero-title">
          <div className="landing-container hero-grid">
            <div className="hero-copy">
              <p className="landing-eyebrow"><span className="eyebrow-line" /><LangText k="landing.eyebrow" fit /></p>
              <h1 id="hero-title"><LangStack>{(l) => <>{translate(l, "landing.title")}<br /><span className="lang-accent">{translate(l, "landing.titleAccent")}</span></>}</LangStack></h1>
              <p className="hero-subtitle"><LangText k="landing.subtitle" /></p>
              <div className="hero-actions">
                <Link to="/check" className="landing-button">{t("landing.check")}<ArrowRight size={20} aria-hidden /></Link>
                <Link to="/check?example=kyc_sms" className="landing-button landing-button-secondary">{t("landing.example")}<ArrowUpRight size={19} aria-hidden /></Link>
              </div>
              <p className="hero-language"><span aria-hidden>अ / A</span><LangText k="landing.languageNote" fit /></p>
            </div>
            <HeroPreview />
          </div>
        </section>

        <aside className="landing-trust" aria-label={t("landing.trustTitle")}>
          <div className="landing-container trust-grid">
            <div className="trust-stat"><strong>{t("landing.loss")}</strong><p>{t("landing.lossLabel")}</p><p className="trust-source">{t("landing.source")}</p></div>
            <div className="trust-message"><span className="trust-rule" aria-hidden /><div><p className="trust-title">{t("landing.trustTitle")}</p><p>{t("landing.guidance")}</p></div></div>
          </div>
        </aside>

        <section className="landing-section landing-container" aria-labelledby="inputs-title">
          <div className="section-heading"><p className="landing-eyebrow">{t("landing.inputsEyebrow")}</p><h2 id="inputs-title">{t("landing.inputsTitle")}</h2><p>{t("landing.inputsSubtitle")}</p></div>
          <InputCarousel labelledBy="inputs-title" items={inputs.map(({ id, icon, visual }) => ({ id, icon, visual, title: t(`landing.input.${id}`), description: t(`landing.input.${id}Desc`) }))} />
        </section>

        <section className="landing-section landing-steps" aria-labelledby="steps-title">
          <div className="landing-container">
            <div className="section-heading"><p className="landing-eyebrow">{t("landing.stepsEyebrow")}</p><h2 id="steps-title">{t("landing.stepsTitle")}</h2></div>
            <ScrollFlow variant="steps" labelledBy="steps-title" items={steps.map(({ id, icon }) => ({ id: String(id), icon, title: t(`landing.step${id}`), description: t(`landing.step${id}Desc`) }))} />
            <div className="verdict-legend"><p>{t("landing.verdictIntro")}</p><div><span className="verdict-chip verdict-chip-scam"><OctagonAlert size={17} aria-hidden />{t("verdict.scam")}</span><span className="verdict-chip verdict-chip-suspicious"><TriangleAlert size={17} aria-hidden />{t("verdict.suspicious")}</span><span className="verdict-chip verdict-chip-nosigns"><Info size={17} aria-hidden />{t("verdict.no_signs")}</span></div></div>
          </div>
        </section>

        <section className="landing-section landing-container action-section" aria-labelledby="actions-title">
          <div className="section-heading"><p className="landing-eyebrow">{t("landing.actionEyebrow")}</p><h2 id="actions-title">{t("landing.actionTitle")}</h2><p>{t("landing.actionSubtitle")}</p></div>
          <ScrollFlow variant="cards" vertical labelledBy="actions-title" items={actions.map(({ id, icon }) => ({ id, icon, title: t(`landing.action.${id}`), description: t(`landing.action.${id}Desc`) }))} />
        </section>

        <section className="landing-section examples-section" aria-labelledby="examples-title">
          <div className="landing-container"><div className="section-heading"><p className="landing-eyebrow">{t("landing.examplesEyebrow")}</p><h2 id="examples-title">{t("landing.examplesTitle")}</h2><p>{t("landing.examplesSubtitle")}</p></div><div className="example-grid">{examples.map(({ id, icon: Icon }) => <Link to={`/check?example=${id}`} key={id} className="example-card"><Icon size={24} strokeWidth={1.6} aria-hidden /><h3>{t(`example.${id}`)}</h3><span>{t("landing.tryExample")}<ArrowUpRight size={18} aria-hidden /></span></Link>)}</div></div>
        </section>

        <section className="landing-section landing-container proof-section" aria-labelledby="proof-title">
          <div className="proof-main"><div className="section-heading"><p className="landing-eyebrow">{t("landing.proofEyebrow")}</p><h2 id="proof-title">{t("landing.proofTitle")}</h2><p>{t("landing.proofBody")}</p></div><dl className="proof-stats"><div><dt>{t("landing.accuracy")}</dt><dd><CountNumber value={BENCHMARK.accuracy} suffix="%" /></dd></div><div><dt>{t("landing.recall")}</dt><dd><CountNumber value={BENCHMARK.recall} delay={250} suffix="%" /></dd></div><div><dt>{t("landing.falsePositive")}</dt><dd><CountNumber value={BENCHMARK.falsePositive} from={90} delay={500} suffix="%" /></dd></div></dl>{benchmarkCases ? <p className="proof-cases">{t("landing.proofCases", { cases: benchmarkCases })}</p> : null}<p className="proof-note"><Info size={18} aria-hidden />{t("landing.proofNote")}</p></div>
          <aside className="privacy-panel"><span className="input-icon"><LockKeyhole size={25} strokeWidth={1.6} aria-hidden /></span><h3>{t("landing.privacyTitle")}</h3><ul><li>{t("landing.privacyBrowser")}</li><li>{t("landing.privacyDelete")}</li><li>{t("landing.privacyNumbers")}</li></ul></aside>
        </section>

        <div className="landing-container cloud-row">
          <p className="cloud-badge"><span>{t("landing.cloud")}</span></p>
          <ul className="cloud-services" aria-label={t("landing.cloudDetail")}>
            {cloudServices.map((name) => <li key={name}>{name}</li>)}
          </ul>
        </div>
        <p className="landing-container cloud-notice">{t("landing.trademark")}</p>
        <section className="landing-final" aria-labelledby="final-title"><div className="landing-container final-inner"><div><p className="landing-eyebrow">SCAM SHIELD</p><h2 id="final-title">{t("landing.finalTitle")}</h2><p>{t("landing.finalBody")}</p></div><Link className="landing-button" to="/check">{t("landing.check")}<ArrowRight size={20} aria-hidden /></Link></div></section>
      </main>
      <footer className="landing-footer landing-container"><div className="landing-footer-top"><BrandLockup /><div className="footer-help"><a href="tel:1930">{t("landing.helpline")}</a><a href="https://cybercrime.gov.in" target="_blank" rel="noreferrer">{t("landing.portal")}<ArrowUpRight size={16} aria-hidden /></a></div></div><div className="landing-footer-bottom"><p>{t("landing.footerNote")}</p><nav aria-label={t("nav.label")}><Link to="/about">{t("nav.about")}</Link><Link to="/trends">{t("nav.trends")}</Link></nav></div></footer>
    </div>
  );
}
