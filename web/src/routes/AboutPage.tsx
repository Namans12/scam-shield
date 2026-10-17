import { Link } from "react-router-dom";
import { BrainCircuit, Cloud, Fingerprint, Info, Phone, ScanSearch, Search, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";

export default function AboutPage() {
  const t = useT();
  return (
    <div>
      <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{t("about.title")}</h1>

      <section className="mt-7 rounded-3xl border border-primary/20 bg-primary/5 p-6 sm:p-8">
        <ScanSearch size={32} className="mb-5 text-primary" aria-hidden />
        <h2 className="text-xl font-bold">{t("about.what.title")}</h2>
        <p className="mt-3 text-lg leading-relaxed">{t("about.what.body")}</p>
        <Button asChild size="lg" className="mt-6"><Link to="/check">{t("about.cta")}<ArrowUpRight aria-hidden /></Link></Button>
      </section>

      <section className="mt-9">
        <h2 className="text-xl font-bold tracking-tight">{t("about.how.title")}</h2>
        <ol className="mt-4 flex flex-col gap-3">
          {([BrainCircuit, Fingerprint, Search] as const).map((Icon, i) => (
            <li key={i} className="flex items-start gap-4 rounded-2xl border border-border bg-card p-5 text-lg leading-relaxed sm:p-6">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary"><Icon size={22} aria-hidden /></span>
              <span>{t((`about.how.${i + 1}`) as "about.how.1" | "about.how.2" | "about.how.3")}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <Info size={24} className="mb-4 text-primary" aria-hidden />
          <h2 className="text-xl font-bold">{t("about.limits.title")}</h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">{t("about.limits.body")}</p>
        </section>
        <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <Fingerprint size={24} className="mb-4 text-primary" aria-hidden />
          <h2 className="text-xl font-bold">{t("about.privacy.title")}</h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">{t("about.privacy.body")}</p>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h2 className="flex items-center gap-3 text-xl font-bold"><Cloud size={24} className="shrink-0 text-primary" aria-hidden />{t("about.tech.title")}</h2>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">{t("about.tech.body")}</p>
      </section>

      <section className="mt-6 rounded-3xl border border-primary/20 bg-primary/5 p-6 sm:p-8">
        <h2 className="text-2xl font-bold tracking-tight">{t("about.help.title")}</h2>
        <p className="mt-3 text-lg leading-relaxed">{t("about.help.body")}</p>
        <Button asChild size="lg" className="mt-5"><a href="tel:1930"><Phone aria-hidden />1930</a></Button>
        <ul className="mt-5 flex flex-col gap-2 text-base leading-relaxed">
          <li><a className="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-4" href="https://cybercrime.gov.in" target="_blank" rel="noopener noreferrer">{t("about.help.cybercrime")}</a></li>
          <li><a className="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-4" href="https://sancharsaathi.gov.in" target="_blank" rel="noopener noreferrer">{t("about.help.chakshu")}</a></li>
        </ul>
      </section>
    </div>
  );
}
