import { useEffect, useId, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DropZone } from "@/components/DropZone";
import { ApiError, checkContent, errorMessageKey } from "@/api";
import { useLang, useT, type MessageKey } from "@/i18n";
import { uploadForCheck, validateFile } from "@/upload";
import { ExampleRow } from "@/components/ExampleRow";
import { EXAMPLES, type Example } from "@/examples";
import { CheckIndicator } from "@/components/check/CheckIndicator";
import { CheckSteps } from "@/components/check/CheckSteps";
import { LangText } from "@/components/landing/LangStack";
import { hasEnoughToJudge, textHasLink } from "@/lib/judgeable";
import { takeSharedPayload } from "@/share-target/sw-share";

const MAX_TEXT = 5000;
/** After this long we tell the person it is slower than usual (the API itself allows up to 45 s). */
const SLOW_AFTER_MS = 20_000;

export default function CheckPage() {
  const t = useT();
  const { lang } = useLang();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const ids = useId();
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<"idle" | "uploading" | "checking">("idle");
  const [progress, setProgress] = useState(0);
  const loading = phase !== "idle";
  const [slow, setSlow] = useState(false);
  // Whether the check in flight includes a link to open, so the steps only mention the isolated browser when it applies.
  const [scanLink, setScanLink] = useState(false);
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

  // "Share to Scam Shield" from another app: the service worker parked the share, pick it up and check it.
  const sharedHandled = useRef(false);
  useEffect(() => {
    if (params.get("shared") !== "1" || sharedHandled.current) return;
    sharedHandled.current = true;
    const next = new URLSearchParams(params);
    next.delete("shared");
    setParams(next, { replace: true });
    if (typeof caches === "undefined") return;
    void takeSharedPayload(caches).then((shared) => {
      if (!shared || !mounted.current) return;
      setText(shared.text ?? "");
      setUrl(shared.url ?? "");
      setFile(shared.file ?? null);
      void run({ text: shared.text ?? "", url: shared.url ?? "", file: shared.file ?? null });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  // Consume a landing-page example once, including under React StrictMode's effect replay.
  const exampleHandled = useRef(false);
  useEffect(() => {
    const id = params.get("example");
    if (!id || exampleHandled.current || params.get("shared") === "1") return;
    exampleHandled.current = true;
    const next = new URLSearchParams(params);
    next.delete("example");
    setParams(next, { replace: true });
    const example = EXAMPLES.find((item) => item.id === id);
    if (example) {
      // Start after StrictMode's mount/cleanup replay, so its cleanup cannot cancel this upload.
      queueMicrotask(() => {
        if (mounted.current) onExample(example);
      });
    }
    // The example is an intake event, not a reaction to form or phase changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const hasInput = text.trim().length > 0 || url.trim().length > 0 || file !== null;
  // Typed text that is too thin to judge gets a calm hint. It never blocks the check (see lib/judgeable).
  const thin = text.trim().length > 0 && !hasEnoughToJudge({ text, url, hasFile: file !== null });

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
      setScanLink(!!input.url.trim() || textHasLink(input.text));
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
        // `unclear` lets the result page avoid a reassuring "no signs" for input that had too little in it to judge.
        const unclear = !hasEnoughToJudge({ text: input.text, url: input.url, hasFile: file !== null });
        navigate(`/result/${result.id}`, { state: { result, unclear } });
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
      <p className="mb-3 flex items-center gap-2 text-base font-semibold text-primary"><ScanSearch size={20} aria-hidden />{t("pages.check.eyebrow")}</p>
      <h1 className="max-w-xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{t("check.title")}</h1>
      <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted-foreground">{t("check.subtitle")}</p>

      <form onSubmit={onSubmit} noValidate className="mt-7 flex flex-col gap-6 rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-7" aria-busy={loading}>
        <div>
          <label htmlFor={`${ids}-text`} className="mb-2 block text-base font-semibold">
            {t("check.textLabel")}
          </label>
          <Textarea
            id={`${ids}-text`}
            className="min-h-48 rounded-2xl border border-input bg-background/50 text-lg sm:min-h-52"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={MAX_TEXT}
            aria-describedby={`${ids}-count${thin ? ` ${ids}-thin` : ""}${text.length >= MAX_TEXT ? ` ${ids}-limit` : ""}`}
            placeholder={t("check.textPlaceholder")}
            readOnly={loading}
          />
          <p id={`${ids}-count`} className="mt-2 text-right text-sm tabular-nums text-muted-foreground">
            {t("check.charCount", { n: text.length, max: MAX_TEXT })}
          </p>
          {thin && (
            <p id={`${ids}-thin`} className="mt-1 text-base leading-relaxed text-muted-foreground"><LangText k="check.thinHint" /></p>
          )}
          {text.length >= MAX_TEXT && (
            <p id={`${ids}-limit`} className="mt-1 text-sm font-medium text-suspicious-fg">{t("check.limitNote")}</p>
          )}
        </div>

        <DropZone file={file} onFileChange={onFileChange} disabled={loading} progress={phase === "uploading" ? progress : null} />

        <div>
          <label htmlFor={`${ids}-url`} className="mb-2 block text-base font-semibold">
            {t("check.linkLabel")}
          </label>
          <Input
            id={`${ids}-url`}
            className="h-12 border bg-background/50"
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

        {/* Always mounted so screen readers announce text changes inside it. Only this line is announced: the steps below are not live. */}
        <div role="status" aria-live="polite">
          {loading && <CheckIndicator text={phase === "uploading"
            ? t("check.uploading", { pct: Math.floor((progress * 100) / 25) * 25 })
            : t("check.checking")} note={slow ? t("check.slow") : undefined} />}
        </div>
        {phase === "checking" && <CheckSteps hasLink={scanLink} />}

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
          aria-describedby={!hasInput && !loading ? `${ids}-empty` : undefined}
          aria-disabled={loading || undefined}
          className="min-h-14 w-full rounded-xl shadow-sm"
        >
          <ScanSearch aria-hidden />
          {t("check.submit")}
        </Button>
        {!hasInput && !loading && (
          <p id={`${ids}-empty`} className="-mt-3 text-base leading-relaxed text-muted-foreground"><LangText k="check.emptyHint" /></p>
        )}
      </form>

      <ExampleRow onPick={onExample} disabled={loading} />
    </div>
  );
}
