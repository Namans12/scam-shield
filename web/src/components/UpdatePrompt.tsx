import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSwUpdate } from "@/pwa/swUpdate";
import { useT } from "@/i18n";

/** Small non-blocking bar shown when a new version of the app is ready. */
export function UpdatePrompt() {
  const t = useT();
  const { updateReady, refresh, dismiss } = useSwUpdate();
  if (!updateReady) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-lg"
    >
      <p className="flex-1 text-base font-medium">{t("update.available")}</p>
      <Button type="button" size="sm" onClick={refresh}>
        <RefreshCw aria-hidden />
        {t("update.refresh")}
      </Button>
      <Button type="button" size="icon" variant="ghost" onClick={dismiss} aria-label={t("update.dismiss")}>
        <X aria-hidden />
      </Button>
    </div>
  );
}
