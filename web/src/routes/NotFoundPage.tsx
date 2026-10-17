import { Link } from "react-router-dom";
import { ArrowLeft, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";

export default function NotFoundPage() {
  const t = useT();
  return (
    <div className="my-8 rounded-3xl border border-border bg-card px-6 py-12 text-center shadow-sm sm:py-16">
      <span className="mx-auto mb-6 flex size-20 items-center justify-center rounded-3xl bg-primary/10 text-primary"><ScanSearch size={36} aria-hidden /></span>
      <p className="mb-3 text-base font-semibold text-muted-foreground">404 · {t("pages.notfound.label")}</p>
      <h1 className="text-3xl font-bold leading-tight tracking-tight">{t("notfound.title")}</h1>
      <p className="mt-3 text-lg leading-relaxed text-muted-foreground">{t("notfound.body")}</p>
      <Button asChild size="lg" className="mt-7"><Link to="/check"><ArrowLeft aria-hidden />{t("notfound.cta")}</Link></Button>
    </div>
  );
}
