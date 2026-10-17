import { Link } from "react-router-dom";
import { ShieldMark } from "./ShieldMark";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";

export function BrandLockup({ className, compact = false }: { className?: string; compact?: boolean }) {
  const t = useT();
  return (
    <Link to="/" aria-label={t("brand.home")} className={cn("brand-lockup", className)}>
      <span aria-hidden="true"><ShieldMark size={compact ? 32 : 44} /></span>
      <span>Scam <span className="brand-word-accent">Shield</span></span>
    </Link>
  );
}
