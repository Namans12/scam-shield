import { useT, type MessageKey } from "@/i18n";

/** Placeholder for pages that arrive in a later task (Trends, History). */
export default function ComingSoonPage({ titleKey }: { titleKey: MessageKey }) {
  const t = useT();
  return (
    <div>
      <h1 className="text-3xl font-bold leading-tight">{t(titleKey)}</h1>
      <div className="mt-6 rounded-2xl border border-border bg-card p-6">
        <p className="text-xl font-semibold">{t("soon.title")}</p>
        <p className="mt-1 text-base text-muted-foreground">{t("soon.body")}</p>
      </div>
    </div>
  );
}
