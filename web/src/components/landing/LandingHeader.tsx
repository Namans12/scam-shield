import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { BrandLockup } from "@/components/brand/BrandLockup";
import { LanguageToggle } from "@/components/layout/LanguageToggle";
import { useT } from "@/i18n";

export function LandingHeader() {
  const t = useT();
  return (
    <header className="landing-header">
      <div className="landing-container landing-header-inner">
        <BrandLockup />
        <nav aria-label={t("nav.label")} className="landing-nav">
          <Link to="/check">{t("nav.check")}</Link>
          <Link to="/trends">{t("nav.trends")}</Link>
          <Link to="/about">{t("nav.about")}</Link>
        </nav>
        <div className="landing-header-actions">
          <LanguageToggle />
          <Link className="landing-button landing-header-cta" to="/check">{t("landing.check")}<ArrowUpRight size={18} aria-hidden /></Link>
        </div>
      </div>
    </header>
  );
}
