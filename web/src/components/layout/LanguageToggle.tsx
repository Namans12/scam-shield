import type { Lang } from "@scam-shield/shared";
import { Segmented } from "@/components/ui/segmented";
import { useLang, useT } from "@/i18n";

/** EN / हिं switch. Always shows both labels in their own script. */
export function LanguageToggle() {
  const { lang, setLang } = useLang();
  const t = useT();
  return (
    <Segmented<Lang>
      aria-label={t("lang.label")}
      value={lang}
      onChange={setLang}
      options={[
        { id: "en", label: "EN", ariaLabel: "English", lang: "en" },
        { id: "hi", label: "हिं", ariaLabel: "हिंदी", lang: "hi" },
      ]}
    />
  );
}
