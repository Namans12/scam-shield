import { useRef, useState } from "react";
import { Loader2, Share2 } from "lucide-react";
import type { CheckResult } from "@scam-shield/shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLang, useT } from "@/i18n";
import { renderWarningCard, warningText } from "@/share/renderCard";

/** Shares the warning card (a picture plus text) where the browser can, otherwise opens WhatsApp with the text. */
export function ShareWarning({ result, compact = false }: { result: CheckResult; compact?: boolean }) {
  const t = useT();
  const { lang } = useLang();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const running = useRef(false);

  async function onShare() {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setFailed(false);
    const text = warningText(result, lang);
    try {
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (typeof nav.share === "function") {
        let data: ShareData = { text };
        try {
          const card = new File([await renderWarningCard(result, lang)], "scam-warning.png", { type: "image/png" });
          if (nav.canShare?.({ files: [card] })) data = { files: [card], text };
        } catch {
          // No canvas or no file sharing: share the text alone.
        }
        await nav.share(data);
      } else {
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
      }
    } catch (e) {
      // Closing the share sheet is the person's choice, not a failure.
      if (!(e instanceof DOMException && e.name === "AbortError")) setFailed(true);
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  const label = busy ? t("share.preparing") : t("share.button");
  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={onShare}
        aria-label={label}
        aria-disabled={busy || undefined}
        className={cn("border-border", compact && "min-h-14 min-w-0 flex-1 flex-col gap-1 border-0 px-2 text-base md:flex-none md:flex-row md:border md:px-4")}
      >
        {busy ? <Loader2 className="motion-safe:animate-spin" aria-hidden /> : <Share2 aria-hidden />}
        {compact ? (
          <>
            <span className="md:hidden">{busy ? t("share.preparing") : t("pages.action.share")}</span>
            <span className="hidden md:inline">{label}</span>
          </>
        ) : label}
      </Button>
      {failed && (
        <p role="alert" className={cn("rounded-xl border border-scam/30 bg-scam-bg p-3 text-base font-medium text-scam-fg", compact && "absolute inset-x-3 bottom-full mb-2 md:static md:mb-0")}>
          {t("share.failed")}
        </p>
      )}
    </>
  );
}
