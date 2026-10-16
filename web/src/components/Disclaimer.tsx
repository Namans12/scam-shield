import { useT } from "@/i18n";

/** Shown under every result. The helpline is a real tel: link so one tap dials it. */
export function Disclaimer() {
  const t = useT();
  return (
    <p className="rounded-xl border border-border bg-secondary p-4 text-base font-medium">
      {t("disclaimer.before")}{" "}
      <a
        href="tel:1930"
        className="inline-flex min-h-11 items-center px-1 font-bold text-primary underline underline-offset-4"
      >
        {t("disclaimer.phone")}
      </a>{" "}
      {t("disclaimer.after")}
    </p>
  );
}
