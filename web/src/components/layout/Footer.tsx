import { useT } from "@/i18n";

export function Footer() {
  const t = useT();
  return (
    <footer className="shell-footer mt-8 border-t border-border px-4 py-6">
      <p>{t("footer.text")}</p>
      <a href="tel:1930">{t("landing.helpline")}</a>
    </footer>
  );
}
