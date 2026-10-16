import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { checkContent, errorMessageKey } from "@/api";
import { useLang, useT, type MessageKey } from "@/i18n";

const MAX_TEXT = 5000;

export default function CheckPage() {
  const t = useT();
  const { lang } = useLang();
  const navigate = useNavigate();
  const ids = useId();
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorKey, setErrorKey] = useState<MessageKey | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const hasInput = text.trim().length > 0 || url.trim().length > 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasInput || loading) return;
    setLoading(true);
    setErrorKey(null);
    try {
      const result = await checkContent({
        text: text.trim() || undefined,
        url: url.trim() || undefined,
        lang,
      });
      if (mounted.current) navigate(`/result/${result.id}`, { state: { result } });
    } catch (err) {
      if (mounted.current) setErrorKey(errorMessageKey(err));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold leading-tight">{t("check.title")}</h1>
      <p className="mt-2 text-lg text-muted-foreground">{t("check.subtitle")}</p>

      <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-5" aria-busy={loading}>
        <div>
          <label htmlFor={`${ids}-text`} className="mb-2 block text-base font-semibold">
            {t("check.textLabel")}
          </label>
          <Textarea
            id={`${ids}-text`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={MAX_TEXT}
            placeholder={t("check.textPlaceholder")}
            disabled={loading}
          />
          <p className="mt-1 text-right text-sm text-muted-foreground">
            {t("check.charCount", { n: text.length, max: MAX_TEXT })}
          </p>
        </div>

        <div>
          <label htmlFor={`${ids}-url`} className="mb-2 block text-base font-semibold">
            {t("check.linkLabel")}
          </label>
          <Input
            id={`${ids}-url`}
            type="url"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t("check.linkPlaceholder")}
            aria-describedby={`${ids}-url-hint`}
            disabled={loading}
          />
          <p id={`${ids}-url-hint`} className="mt-1 text-sm text-muted-foreground">
            {t("check.linkHint")}
          </p>
        </div>

        {errorKey && (
          <div role="alert" className="rounded-xl border-l-8 border-scam bg-scam-bg p-4 text-scam-fg">
            <p className="text-base font-bold">{t("error.title")}</p>
            <p className="mt-1 text-base">{t(errorKey)}</p>
          </div>
        )}

        {loading && (
          <p role="status" className="flex items-center gap-3 text-base font-medium">
            <Loader2 className="animate-spin text-primary" size={24} aria-hidden />
            {t("check.checking")}
          </p>
        )}

        <Button type="submit" size="lg" disabled={!hasInput || loading} className="w-full sm:w-auto sm:self-start">
          <ScanSearch aria-hidden />
          {t("check.submit")}
        </Button>
      </form>
    </div>
  );
}
