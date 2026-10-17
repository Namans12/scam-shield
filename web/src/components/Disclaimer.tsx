import { useT } from "@/i18n";

/** Shown under every result. The helpline is a real tel: link so one tap dials it. */
export function Disclaimer() {
  const t = useT();
  return (
    <p className="rounded-2xl border border-primary/20 bg-primary/5 px-5 py-3 text-base font-medium leading-relaxed">
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
