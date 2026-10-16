import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DropZone } from "@/components/DropZone";
import { checkContent, errorMessageKey } from "@/api";
import { useLang, useT, type MessageKey } from "@/i18n";
import { uploadForCheck, validateFile } from "@/upload";

const MAX_TEXT = 5000;
/** After this long we tell the person it is slower than usual (the API itself allows up to 45 s). */
const SLOW_AFTER_MS = 20_000;

export default function CheckPage() {
  const t = useT();
  const { lang } = useLang();
  const navigate = useNavigate();
  const ids = useId();
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<"idle" | "uploading" | "checking">("idle");
  const [progress, setProgress] = useState(0);
  const loading = phase !== "idle";
  const [slow, setSlow] = useState(false);
  const [errorKey, setErrorKey] = useState<MessageKey | null>(null);
  const mounted = useRef(true);
  // A file that is already uploaded is not uploaded again if only the check failed and is retried.
  const uploaded = useRef<{ file: File; storagePath: string; mimeType: string } | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!loading) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [loading]);

  const hasInput = text.trim().length > 0 || url.trim().length > 0 || file !== null;

  function onFileChange(next: File | null) {
    uploaded.current = null;
    setErrorKey(null);
    setFile(next);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasInput || loading) return;
    setErrorKey(null);
    setProgress(0);
    try {
      let attachment: { storagePath: string; mimeType: string } | undefined;
      if (file) {
        const valid = validateFile(file);
        if (!valid.ok) {
          setErrorKey(`error.${valid.code}`);
          return;
        }
        setPhase("uploading");
        if (uploaded.current?.file === file) {
          attachment = uploaded.current;
        } else {
          attachment = await uploadForCheck(file, (f) => {
            if (mounted.current) setProgress(f);
          });
          uploaded.current = { file, ...attachment };
        }
        if (mounted.current) setProgress(1);
      }
      setPhase("checking");
      const result = await checkContent({
        ...(attachment && { storagePath: attachment.storagePath, mimeType: attachment.mimeType }),
        text: text.trim() || undefined,
        url: url.trim() || undefined,
        lang,
      });
      if (mounted.current) {
        setFile(null);
        uploaded.current = null;
        navigate(`/result/${result.id}`, { state: { result } });
      }
    } catch (err) {
      if (mounted.current) setErrorKey(errorMessageKey(err));
    } finally {
      if (mounted.current) setPhase("idle");
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
            readOnly={loading}
          />
          <p className="mt-1 text-right text-sm text-muted-foreground">
            {t("check.charCount", { n: text.length, max: MAX_TEXT })}
          </p>
          {text.length >= MAX_TEXT && (
            <p className="mt-1 text-sm font-medium text-suspicious-fg">{t("check.limitNote")}</p>
          )}
        </div>

        <DropZone file={file} onFileChange={onFileChange} disabled={loading} progress={phase === "uploading" ? progress : null} />

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
            readOnly={loading}
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

        {/* Always mounted so screen readers announce text changes inside it. */}
        <p role="status" aria-live="polite" className="flex min-h-6 items-center gap-3 text-base font-medium">
          {loading && (
            <>
              <Loader2 className="animate-spin text-primary" size={24} aria-hidden />
              {phase === "uploading"
                ? t("check.uploading", { pct: Math.floor((progress * 100) / 25) * 25 })
                : slow
                  ? t("check.slow")
                  : t("check.checking")}
            </>
          )}
        </p>

        {/* While loading the button is aria-disabled rather than disabled, so keyboard focus stays on it. */}
        <Button
          type="submit"
          size="lg"
          disabled={!hasInput && !loading}
          aria-disabled={loading || undefined}
          className="w-full sm:w-auto sm:self-start"
        >
          <ScanSearch aria-hidden />
          {t("check.submit")}
        </Button>
      </form>
    </div>
  );
}
