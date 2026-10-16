import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DropZone } from "@/components/DropZone";
import { ApiError, checkContent, errorMessageKey } from "@/api";
import { useLang, useT, type MessageKey } from "@/i18n";
import { uploadForCheck, validateFile } from "@/upload";
import { ExampleRow } from "@/components/ExampleRow";
import type { Example } from "@/examples";

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
  const submitRef = useRef<HTMLButtonElement>(null);
  // Set while a submit is in flight, so a second submit in the same tick cannot start a second upload.
  const busy = useRef(false);
  const uploadAbort = useRef<AbortController | null>(null);
  // A file that is already uploaded is not uploaded again if only the check failed and is retried.
  const uploaded = useRef<{ file: File; storagePath: string; mimeType: string } | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // Leaving the page must not leave up to 15 MB uploading in the background.
      uploadAbort.current?.abort();
    };
  }, []);

  // Each phase gets its own "taking longer than usual" clock: a slow upload and a slow check both say so.
  useEffect(() => {
    setSlow(false);
    if (phase === "idle") return;
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  // The browser opens a file that is dropped anywhere outside the drop zone, leaving the page.
  // Only file drags are stopped, so dragging text into the message box still works.
  useEffect(() => {
    const stop = (e: DragEvent) => {
      if (Array.from(e.dataTransfer?.types ?? []).includes("Files")) e.preventDefault();
    };
    window.addEventListener("dragover", stop);
    window.addEventListener("drop", stop);
    return () => {
      window.removeEventListener("dragover", stop);
      window.removeEventListener("drop", stop);
    };
  }, []);

  const hasInput = text.trim().length > 0 || url.trim().length > 0 || file !== null;

  function onFileChange(next: File | null) {
    uploaded.current = null;
    setErrorKey(null);
    setFile(next);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasInput) return;
    void run({ text, url, file });
  }

  /** Fills the form with an example and runs it through the normal pipeline (assets are uploaded like any file). */
  function onExample(ex: Example) {
    if (loading || busy.current) return;
    const caption = ex.text ?? "";
    setText(caption);
    setUrl("");
    setFile(null);
    uploaded.current = null;
    const asset = ex.asset;
    void run(
      { text: caption, url: "", file: null },
      asset
        ? async () => {
            const res = await fetch(asset).catch(() => null);
            if (!res?.ok) throw new ApiError("network", 0);
            const blob = await res.blob();
            return new File([blob], asset.split("/").pop()!, { type: ex.mimeType ?? blob.type });
          }
        : undefined,
    );
  }

  async function run(input: { text: string; url: string; file: File | null }, loadFile?: () => Promise<File>) {
    if (loading || busy.current) return;
    busy.current = true;
    const controller = new AbortController();
    uploadAbort.current = controller;
    setErrorKey(null);
    setProgress(0);
    try {
      let file = input.file;
      if (loadFile) {
        setPhase("uploading");
        file = await loadFile();
        if (!mounted.current) return;
        setFile(file);
      }
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
          attachment = await uploadForCheck(file, {
            signal: controller.signal,
            onProgress: (f) => {
              if (mounted.current) setProgress(f);
            },
          });
          uploaded.current = { file, ...attachment };
        }
        if (mounted.current) setProgress(1);
      }
      setPhase("checking");
      const result = await checkContent({
        ...(attachment && { storagePath: attachment.storagePath, mimeType: attachment.mimeType }),
        text: input.text.trim() || undefined,
        url: input.url.trim() || undefined,
        lang,
      });
      if (mounted.current) {
        setFile(null);
        uploaded.current = null;
        navigate(`/result/${result.id}`, { state: { result } });
      }
    } catch (err) {
      // Cancelling is the person's own choice, not an error: the file stays attached to try again.
      const cancelled = err instanceof ApiError && err.code === "canceled";
      if (mounted.current && !cancelled) setErrorKey(errorMessageKey(err));
    } finally {
      busy.current = false;
      uploadAbort.current = null;
      if (mounted.current) {
        setPhase("idle");
        // The Cancel button is gone now: put focus back on Check rather than dropping it.
        if (controller.signal.aborted) submitRef.current?.focus();
      }
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
              <span>
                {phase === "uploading"
                  ? t("check.uploading", { pct: Math.floor((progress * 100) / 25) * 25 })
                  : t("check.checking")}
                {slow && <span className="mt-1 block font-normal text-muted-foreground">{t("check.slow")}</span>}
              </span>
            </>
          )}
        </p>

        {/* Enabled on purpose (not aria-disabled): a stalled upload must always be cancellable. */}
        {phase === "uploading" && (
          <Button type="button" variant="outline" size="lg" className="w-full sm:w-auto sm:self-start" onClick={() => uploadAbort.current?.abort()}>
            {t("check.cancelUpload")}
          </Button>
        )}

        {/* While loading the button is aria-disabled rather than disabled, so keyboard focus stays on it. */}
        <Button
          ref={submitRef}
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

      <ExampleRow onPick={onExample} disabled={loading} />
    </div>
  );
}
