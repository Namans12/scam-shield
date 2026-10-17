import { Link, Navigate, useLocation } from "react-router-dom";
import { ArrowRight, ArrowUpRight, MessageSquareText, Image, QrCode, Link2, AudioLines, FileText, UsersRound, Send, ScanSearch, Eye, Route, LockKeyhole, Cloud, OctagonAlert, TriangleAlert, Info } from "lucide-react";
import { useT } from "@/i18n";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { HeroPreview } from "@/components/landing/HeroPreview";
import { BrandLockup } from "@/components/brand/BrandLockup";

const inputs = [
  { id: "text", icon: MessageSquareText },
  { id: "image", icon: Image },
  { id: "qr", icon: QrCode },
  { id: "link", icon: Link2 },
  { id: "voice", icon: AudioLines },
] as const;
const steps = [{ id: 1, icon: ScanSearch }, { id: 2, icon: Eye }, { id: 3, icon: Route }] as const;
const actions = [{ id: "complaint", icon: FileText }, { id: "reports", icon: UsersRound }, { id: "share", icon: Send }] as const;
const examples = [{ id: "kyc_sms", icon: MessageSquareText }, { id: "fake_payment", icon: Image }, { id: "qr_receive", icon: QrCode }, { id: "digital_arrest", icon: AudioLines }] as const;

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
              <p className="landing-eyebrow"><span className="eyebrow-line" />{t("landing.eyebrow")}</p>
              <h1 id="hero-title">{t("landing.title")}<br /><span>{t("landing.titleAccent")}</span></h1>
              <p className="hero-subtitle">{t("landing.subtitle")}</p>
              <div className="hero-actions">
                <Link to="/check" className="landing-button">{t("landing.check")}<ArrowRight size={20} aria-hidden /></Link>
                <Link to="/check?example=kyc_sms" className="landing-button landing-button-secondary">{t("landing.example")}<ArrowUpRight size={19} aria-hidden /></Link>
              </div>
              <p className="hero-language"><span aria-hidden>अ / A</span>{t("landing.languageNote")}</p>
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
          <div className="input-grid">{inputs.map(({ id, icon: Icon }) => <div className="input-tile" key={id}><span className="input-icon"><Icon size={25} strokeWidth={1.6} aria-hidden /></span><h3>{t(`landing.input.${id}`)}</h3><p>{t(`landing.input.${id}Desc`)}</p></div>)}</div>
        </section>

        <section className="landing-section landing-steps" aria-labelledby="steps-title">
          <div className="landing-container">
            <div className="section-heading"><p className="landing-eyebrow">{t("landing.stepsEyebrow")}</p><h2 id="steps-title">{t("landing.stepsTitle")}</h2></div>
            <ol className="steps-grid">{steps.map(({ id, icon: Icon }) => <li key={id}><div className="step-top"><span className="step-number">0{id}</span><Icon size={26} strokeWidth={1.5} aria-hidden /></div><h3>{t(`landing.step${id}`)}</h3><p>{t(`landing.step${id}Desc`)}</p></li>)}</ol>
            <div className="verdict-legend"><p>{t("landing.verdictIntro")}</p><div><span className="verdict-chip verdict-chip-scam"><OctagonAlert size={17} aria-hidden />{t("verdict.scam")}</span><span className="verdict-chip verdict-chip-suspicious"><TriangleAlert size={17} aria-hidden />{t("verdict.suspicious")}</span><span className="verdict-chip verdict-chip-nosigns"><Info size={17} aria-hidden />{t("verdict.no_signs")}</span></div></div>
          </div>
        </section>

        <section className="landing-section landing-container action-section" aria-labelledby="actions-title">
          <div className="section-heading"><p className="landing-eyebrow">{t("landing.actionEyebrow")}</p><h2 id="actions-title">{t("landing.actionTitle")}</h2><p>{t("landing.actionSubtitle")}</p></div>
          <div className="actions-grid">{actions.map(({ id, icon: Icon }, index) => <article key={id} className="action-card"><div className="action-card-top"><Icon size={28} strokeWidth={1.5} aria-hidden /><span aria-hidden>0{index + 1}</span></div><h3>{t(`landing.action.${id}`)}</h3><p>{t(`landing.action.${id}Desc`)}</p></article>)}</div>
        </section>

        <section className="landing-section examples-section" aria-labelledby="examples-title">
          <div className="landing-container"><div className="section-heading"><p className="landing-eyebrow">{t("landing.examplesEyebrow")}</p><h2 id="examples-title">{t("landing.examplesTitle")}</h2><p>{t("landing.examplesSubtitle")}</p></div><div className="example-grid">{examples.map(({ id, icon: Icon }) => <Link to={`/check?example=${id}`} key={id} className="example-card"><Icon size={24} strokeWidth={1.6} aria-hidden /><h3>{t(`example.${id}`)}</h3><span>{t("landing.tryExample")}<ArrowUpRight size={18} aria-hidden /></span></Link>)}</div></div>
        </section>

        <section className="landing-section landing-container proof-section" aria-labelledby="proof-title">
          <div className="proof-main"><div className="section-heading"><p className="landing-eyebrow">{t("landing.proofEyebrow")}</p><h2 id="proof-title">{t("landing.proofTitle")}</h2><p>{t("landing.proofBody")}</p></div><dl className="proof-stats"><div><dt>{t("landing.accuracy")}</dt><dd>98<span>%</span></dd></div><div><dt>{t("landing.recall")}</dt><dd>100<span>%</span></dd></div><div><dt>{t("landing.falsePositive")}</dt><dd>4.2<span>%</span></dd></div></dl><p className="proof-note"><Info size={18} aria-hidden />{t("landing.proofNote")}</p></div>
          <aside className="privacy-panel"><span className="input-icon"><LockKeyhole size={25} strokeWidth={1.6} aria-hidden /></span><h3>{t("landing.privacyTitle")}</h3><ul><li>{t("landing.privacyBrowser")}</li><li>{t("landing.privacyDelete")}</li><li>{t("landing.privacyNumbers")}</li></ul></aside>
        </section>

        <div className="landing-container cloud-row"><p><Cloud size={24} strokeWidth={1.6} aria-hidden />{t("landing.cloud")}</p><p>{t("landing.cloudDetail")}</p></div>
        <section className="landing-final" aria-labelledby="final-title"><div className="landing-container final-inner"><div><p className="landing-eyebrow">SCAM SHIELD</p><h2 id="final-title">{t("landing.finalTitle")}</h2><p>{t("landing.finalBody")}</p></div><Link className="landing-button" to="/check">{t("landing.check")}<ArrowRight size={20} aria-hidden /></Link></div></section>
      </main>
      <footer className="landing-footer landing-container"><div className="landing-footer-top"><BrandLockup /><div className="footer-help"><a href="tel:1930">{t("landing.helpline")}</a><a href="https://cybercrime.gov.in" target="_blank" rel="noreferrer">{t("landing.portal")}<ArrowUpRight size={16} aria-hidden /></a></div></div><div className="landing-footer-bottom"><p>{t("landing.footerNote")}</p><nav aria-label={t("nav.label")}><Link to="/about">{t("nav.about")}</Link><Link to="/trends">{t("nav.trends")}</Link></nav></div></footer>
    </div>
  );
}
