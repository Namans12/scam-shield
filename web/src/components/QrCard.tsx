import { QrCode } from "lucide-react";
import type { QrInfo } from "@scam-shield/shared";
import { useT } from "@/i18n";

const MAX_RAW = 300;

/**
 * "5000", "₹5,000.00", "Rs. 500" and "INR 75" all become "₹..." exactly once.
 * Anything that is not a plain number is shown as it came, with no prefix.
 */
function formatAmount(am: string): string {
  const stripped = am.trim().replace(/^(?:₹|rs\.?|inr)\s*/i, "");
  return /^\d[\d,]*(?:\.\d+)?$/.test(stripped) ? `₹${stripped}` : am;
}

/** Everything in a QR code is attacker-controlled: it is only ever rendered as text, never as a link. */
export function QrCard({ qr }: { qr: QrInfo }) {
  const t = useT();

  if (qr.upi) {
    const { pa, pn, am, tn } = qr.upi;
    return (
      <div className="rounded-xl border-l-8 border-suspicious bg-suspicious-bg p-4 text-suspicious-fg">
        <p className="flex items-center gap-2 text-lg font-bold">
          <QrCode size={22} aria-hidden />
          {t("qr.payTitle")}
        </p>
        <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 text-base sm:grid-cols-[max-content_1fr]">
          <dt className="font-medium">{t("qr.payee")}</dt>
          <dd className="font-mono font-semibold break-anywhere" data-testid="qr-payee">
            {pa}
          </dd>
          {pn && (
            <>
              <dt className="font-medium">{t("qr.payeeName")}</dt>
              <dd className="break-anywhere">{pn}</dd>
            </>
          )}
          {am && (
            <>
              <dt className="font-medium">{t("qr.amount")}</dt>
              <dd className="font-semibold">{formatAmount(am)}</dd>
            </>
          )}
          {tn && (
            <>
              <dt className="font-medium">{t("qr.note")}</dt>
              <dd className="break-anywhere">{tn}</dd>
            </>
          )}
        </dl>
        <p className="mt-3 text-base font-medium">{t("qr.payWarning")}</p>
        <p className="mt-1 text-sm">{t("qr.textOnly")}</p>
      </div>
    );
  }

  const cut = qr.raw.length > MAX_RAW;
  const shown = cut ? `${qr.raw.slice(0, MAX_RAW - 1)}…` : qr.raw;
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="flex items-center gap-2 text-base font-medium">
        <QrCode size={20} aria-hidden />
        {t("qr.contains")}
      </p>
      <p className="mt-2 font-mono text-base break-anywhere whitespace-pre-wrap" data-testid="qr-raw">
        {shown}
      </p>
      {cut && (
        <p className="mt-1 text-sm text-muted-foreground" data-testid="qr-shortened">
          {t("qr.shortened")}
        </p>
      )}
      <p className="mt-2 text-sm text-muted-foreground">{t("qr.textOnly")}</p>
    </div>
  );
}
