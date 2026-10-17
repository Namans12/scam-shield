import { ArrowDown, Search, MessageSquareText, OctagonAlert, CornerDownRight } from "lucide-react";
import { useT } from "@/i18n";
import { ShieldMark } from "@/components/brand/ShieldMark";

/** A deliberately labelled, static example. It never sends a check request. */
export function HeroPreview() {
  const t = useT();
  return (
    <figure className="hero-preview" aria-label={t("landing.heroLabel")}>
      <div className="preview-orbit preview-orbit-one" aria-hidden />
      <div className="preview-orbit preview-orbit-two" aria-hidden />
      <div className="preview-spark" aria-hidden><ShieldMark size={64} /></div>
      <div className="message-preview">
        <div className="preview-topline"><MessageSquareText size={19} aria-hidden /><span>{t("landing.demo")}</span><span className="preview-dots" aria-hidden>•••</span></div>
        <p className="preview-sender">{t("landing.messageSender")}</p>
        <div className="message-bubble"><p>{t("landing.message")}</p><span className="message-fake-link">{t("landing.messageLink")}</span></div>
        <div className="preview-scan"><Search size={17} aria-hidden /><span>{t("landing.inspecting")}</span><ArrowDown size={17} aria-hidden /></div>
      </div>
      <div className="verdict-preview">
        <div className="preview-verdict-title"><span className="preview-alert-icon"><OctagonAlert size={25} aria-hidden /></span><div><span className="preview-result-label">{t("landing.previewResult")}</span><h2>{t("verdict.scam")}</h2></div><span className="preview-score" aria-label={t("result.riskOutOf", { score: 96 })}>96<span>/100</span></span></div>
        <div className="preview-meter" aria-hidden><span /></div>
        <p className="preview-flags-title">{t("landing.previewHeading")}</p>
        <ul className="preview-flags"><li><CornerDownRight size={17} aria-hidden />{t("landing.previewFlag1")}</li><li><CornerDownRight size={17} aria-hidden />{t("landing.previewFlag2")}</li></ul>
        <p className="preview-advice">{t("landing.previewAdvice")}</p>
      </div>
      <figcaption>{t("landing.previewNote")}</figcaption>
    </figure>
  );
}
