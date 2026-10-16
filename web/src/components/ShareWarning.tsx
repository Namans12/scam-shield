import { useRef, useState } from "react";
import { Loader2, Share2 } from "lucide-react";
import type { CheckResult } from "@scam-shield/shared";
import { Button } from "@/components/ui/button";
import { useLang, useT } from "@/i18n";
import { renderWarningCard, warningText } from "@/share/renderCard";

/** Shares the warning card (a picture plus text) where the browser can, otherwise opens WhatsApp with the text. */
export function ShareWarning({ result }: { result: CheckResult }) {
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

  return (
    <>
      <Button type="button" variant="outline" onClick={onShare} aria-disabled={busy || undefined}>
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Share2 aria-hidden />}
        {busy ? t("share.preparing") : t("share.button")}
      </Button>
      {failed && (
        <p role="alert" className="text-sm font-medium text-scam-fg">
          {t("share.failed")}
        </p>
      )}
    </>
  );
}
