import { useT } from "@/i18n";

export function Footer() {
  const t = useT();
  return (
    <footer className="mt-8 border-t border-border px-4 py-6">
      <p className="text-center text-sm text-muted-foreground">{t("footer.text")}</p>
    </footer>
  );
}
