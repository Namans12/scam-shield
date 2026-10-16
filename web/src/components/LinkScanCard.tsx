import { Link2 } from "lucide-react";
import type { LinkScan } from "@scam-shield/shared";
import { useT } from "@/i18n";

// The scanner only ever returns JPEG screenshots. Anything else is not rendered:
// a data: URL is attacker-influenced, so we accept exactly one shape.
const JPEG_DATA_URL = /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/;

export function isRenderableScreenshot(src: string | undefined): src is string {
  return typeof src === "string" && JPEG_DATA_URL.test(src);
}

/**
 * What a link really leads to. The final address is shown as plain text and is
 * deliberately NOT a link, so nobody opens a suspected scam site by tapping it.
 */
export function LinkScanCard({ scan }: { scan: LinkScan }) {
  const t = useT();
  const redirects = scan.redirects.length;
  const finalUrl = scan.finalUrl ?? scan.requestedUrl;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Link2 size={18} aria-hidden />
        {t("linkscan.finalUrl")}
      </div>
      <p className="mt-1 font-mono text-base font-medium break-anywhere" data-testid="final-url">
        {finalUrl}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{t("linkscan.textOnly")}</p>

      <p className="mt-3 text-base">
        {redirects === 0
          ? t("linkscan.redirectsNone")
          : redirects === 1
            ? t("linkscan.redirectsOne")
            : t("linkscan.redirectsMany", { n: redirects })}
      </p>

      {scan.title && (
        <p className="mt-2 text-base break-anywhere">
          <span className="text-muted-foreground">{t("linkscan.pageTitle")}: </span>
          {scan.title}
        </p>
      )}

      {scan.blockedReason && (
        <p role="note" className="mt-3 rounded-lg bg-suspicious-bg px-3 py-2 text-base text-suspicious-fg">
          {t("linkscan.blocked")}
        </p>
      )}

      {isRenderableScreenshot(scan.screenshotDataUrl) && (
        <figure className="mt-3">
          <img
            src={scan.screenshotDataUrl}
            alt={t("linkscan.screenshotAlt")}
            className="max-h-96 w-full rounded-lg border border-border object-cover object-top"
          />
          <figcaption className="mt-1 text-sm text-muted-foreground">{t("linkscan.screenshotNote")}</figcaption>
        </figure>
      )}
    </div>
  );
}
