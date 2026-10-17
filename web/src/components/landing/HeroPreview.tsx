import { ArrowDown, Search, MessageSquareText, OctagonAlert, CornerDownRight } from "lucide-react";
import { useT } from "@/i18n";
import { ShieldMark } from "@/components/brand/ShieldMark";
import { LangText } from "@/components/landing/LangStack";

/** A deliberately labelled, static example. It never sends a check request. */
export function HeroPreview() {
  const t = useT();
  return (
    <figure className="hero-preview" aria-label={t("landing.heroLabel")}>
      <div className="preview-orbit preview-orbit-one" aria-hidden />
      <div className="preview-orbit preview-orbit-two" aria-hidden />
      <div className="preview-spark" aria-hidden><ShieldMark size={64} /></div>
      <div className="message-preview">
        <div className="preview-topline"><MessageSquareText size={19} aria-hidden /><LangText k="landing.demo" fit /><span className="preview-dots" aria-hidden>•••</span></div>
        <p className="preview-sender"><LangText k="landing.messageSender" fit /></p>
        <div className="message-bubble"><p><LangText k="landing.message" /></p><span className="message-fake-link">{t("landing.messageLink")}</span></div>
        <div className="preview-scan"><Search size={17} aria-hidden /><LangText k="landing.inspecting" fit /><ArrowDown size={17} aria-hidden /></div>
      </div>
      <div className="verdict-preview">
        <div className="preview-verdict-title"><span className="preview-alert-icon"><OctagonAlert size={25} aria-hidden /></span><div><span className="preview-result-label"><LangText k="landing.previewResult" fit /></span><h2><LangText k="verdict.scam" fit /></h2></div><span className="preview-score" aria-label={t("result.riskOutOf", { score: 96 })}>96<span>/100</span></span></div>
        <div className="preview-meter" aria-hidden><span /></div>
        <p className="preview-flags-title"><LangText k="landing.previewHeading" fit /></p>
        <ul className="preview-flags"><li><CornerDownRight size={17} aria-hidden /><LangText k="landing.previewFlag1" fit /></li><li><CornerDownRight size={17} aria-hidden /><LangText k="landing.previewFlag2" fit /></li></ul>
        <p className="preview-advice"><LangText k="landing.previewAdvice" /></p>
      </div>
      <figcaption><LangText k="landing.previewNote" fit /></figcaption>
    </figure>
  );
}
