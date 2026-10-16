import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";

export default function AboutPage() {
  const t = useT();
  return (
    <div>
      <h1 className="text-3xl font-bold leading-tight">{t("about.title")}</h1>

      <section className="mt-6">
        <h2 className="text-xl font-bold">{t("about.what.title")}</h2>
        <p className="mt-2 text-lg leading-relaxed">{t("about.what.body")}</p>
      </section>

      <section className="mt-6">
        <h2 className="text-xl font-bold">{t("about.how.title")}</h2>
        <ul className="mt-2 flex list-disc flex-col gap-2 pl-6 text-lg leading-relaxed marker:text-primary">
          <li>{t("about.how.1")}</li>
          <li>{t("about.how.2")}</li>
          <li>{t("about.how.3")}</li>
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-xl font-bold">{t("about.limits.title")}</h2>
        <p className="mt-2 text-lg leading-relaxed">{t("about.limits.body")}</p>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-secondary p-5">
        <h2 className="text-xl font-bold">{t("about.help.title")}</h2>
        <p className="mt-2 text-lg leading-relaxed">{t("about.help.body")}</p>
        <Button asChild size="lg" className="mt-4">
          <a href="tel:1930">1930</a>
        </Button>
      </section>

      <Button asChild variant="outline" size="lg" className="mt-8">
        <Link to="/">{t("about.cta")}</Link>
      </Button>
    </div>
  );
}
