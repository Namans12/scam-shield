import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";

export default function NotFoundPage() {
  const t = useT();
  return (
    <div className="py-10 text-center">
      <h1 className="text-2xl font-bold">{t("notfound.title")}</h1>
      <p className="mt-2 text-base text-muted-foreground">{t("notfound.body")}</p>
      <Button asChild size="lg" className="mt-6">
        <Link to="/">{t("notfound.cta")}</Link>
      </Button>
    </div>
  );
}
