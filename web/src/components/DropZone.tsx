import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT, type MessageKey } from "@/i18n";
import { validateFile } from "@/upload";
import { cn } from "@/lib/utils";

/** No `capture` attribute on purpose: on a phone this lets the person pick the camera, the gallery or a voice recording. */
export const FILE_ACCEPT = "image/png,image/jpeg,image/webp,audio/*";

export interface DropZoneProps {
  /** The one attached file, or null. */
  file: File | null;
  /** Called with a valid file, or with null when it is removed. Invalid files never reach this. */
  onFileChange: (file: File | null) => void;
  /** True while a check is running: nothing can be added or removed. */
  disabled?: boolean;
  /** Upload progress between 0 and 1, shown as a progress bar while a file is attached. */
  progress?: number | null;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isTextField(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable || el instanceof HTMLTextAreaElement) return true;
  return el instanceof HTMLInputElement && !["file", "checkbox", "radio", "button", "submit"].includes(el.type);
}

function pastedImage(data: DataTransfer): File | null {
  for (const f of Array.from(data.files ?? [])) if (f.type.startsWith("image/")) return f;
  for (const item of Array.from(data.items ?? [])) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const f = item.getAsFile();
      if (f) return f;
    }
  }
  return null;
}

/**
 * One drop target for a screenshot, a QR code photo or a voice note: drag and
 * drop, a file picker, and (while mounted) pasting an image anywhere on the page.
 * Validation errors are shown right under the zone.
 */
export function DropZone({ file, onFileChange, disabled = false, progress = null }: DropZoneProps) {
  const t = useT();
  const ids = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [errorKey, setErrorKey] = useState<MessageKey | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file || typeof URL.createObjectURL !== "function") {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const choose = useCallback(
    (candidate: File | undefined) => {
      if (!candidate || disabled) return;
      const result = validateFile(candidate);
      if (!result.ok) {
        setErrorKey(`error.${result.code}`);
        return;
      }
      setErrorKey(null);
      onFileChange(candidate);
    },
    [disabled, onFileChange],
  );

  // Paste a screenshot straight from the clipboard. Only an image on the clipboard
  // is taken: pasting text, in the message box or anywhere else, is left alone.
  const chooseRef = useRef(choose);
  chooseRef.current = choose;
  useEffect(() => {
    if (disabled) return;
    function onPaste(e: ClipboardEvent) {
      const data = e.clipboardData;
      if (!data) return;
      const image = pastedImage(data);
      if (!image) return;
      // Copying from a document can put both a picture and its text on the clipboard.
      // In a text box the person means the text.
      if (isTextField(e.target) && data.getData("text/plain")) return;
      e.preventDefault();
      chooseRef.current(image);
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [disabled]);

  function hasFiles(e: React.DragEvent) {
    return Array.from(e.dataTransfer?.types ?? []).includes("Files");
  }

  const isAudio = file?.type.startsWith("audio/") ?? false;
  const hintId = `${ids}-hint`;
  const errorId = `${ids}-error`;
  const pct = progress == null ? null : Math.round(Math.min(1, Math.max(0, progress)) * 100);

  return (
    <div
      role="group"
      aria-labelledby={`${ids}-label`}
      aria-describedby={errorKey ? `${hintId} ${errorId}` : hintId}
      data-testid="dropzone"
      data-dragging={dragging || undefined}
      onDragEnter={(e) => {
        if (disabled || !hasFiles(e)) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragOver={(e) => {
        e.preventDefault(); // allow the drop, and stop the browser opening the file
        if (!disabled && hasFiles(e)) setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        choose(e.dataTransfer?.files?.[0]);
      }}
      className={cn(
        "rounded-xl border-2 border-dashed bg-card p-4 transition-colors",
        dragging ? "border-primary bg-secondary" : "border-input",
      )}
    >
      <p id={`${ids}-label`} className="text-base font-semibold">
        {t("dropzone.label")}
      </p>

      <input
        ref={inputRef}
        type="file"
        data-testid="file-input"
        accept={FILE_ACCEPT}
        className="hidden"
        tabIndex={-1}
        aria-hidden
        disabled={disabled}
        onChange={(e) => {
          choose(e.target.files?.[0]);
          e.target.value = ""; // so choosing the same file again after removing it still fires
        }}
      />

      {file ? (
        <div className="mt-3 flex flex-wrap items-start gap-3">
          {!isAudio && previewUrl && (
            <img
              src={previewUrl}
              alt={t("dropzone.previewAlt", { name: file.name })}
              className="size-20 shrink-0 rounded-lg border border-border object-cover"
            />
          )}
          <div className="min-w-0 flex-1 basis-40">
            <p className="text-base font-medium break-anywhere">{file.name}</p>
            <p className="text-sm text-muted-foreground">{formatSize(file.size)}</p>
          </div>
          {isAudio && (
            <audio controls src={previewUrl ?? undefined} className="h-11 w-full" aria-label={t("dropzone.audioLabel")} />
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full sm:ml-auto sm:w-auto"
            aria-label={t("dropzone.removeLabel", { name: file.name })}
            aria-disabled={disabled || undefined}
            onClick={() => {
              if (disabled) return;
              setErrorKey(null);
              onFileChange(null);
            }}
          >
            <X aria-hidden />
            {t("dropzone.remove")}
          </Button>
        </div>
      ) : (
        <div className="mt-3 flex flex-col items-start gap-2">
          <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} aria-disabled={disabled || undefined}>
            <Upload aria-hidden />
            {t("dropzone.choose")}
          </Button>
          <p className="text-sm text-muted-foreground">{dragging ? t("dropzone.dropActive") : t("dropzone.drop")}</p>
        </div>
      )}

      {file && pct !== null && (
        <div
          role="progressbar"
          aria-label={t("dropzone.progress")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary"
        >
          <div className="h-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
        </div>
      )}

      <p id={hintId} className="mt-3 text-sm text-muted-foreground">
        {t("dropzone.hint")}
      </p>

      {errorKey && (
        <p id={errorId} role="alert" className="mt-2 rounded-lg bg-scam-bg px-3 py-2 text-base font-medium text-scam-fg">
          {t(errorKey)}
        </p>
      )}
    </div>
  );
}
