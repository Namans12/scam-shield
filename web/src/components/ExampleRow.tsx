import { EXAMPLES, type Example } from "@/examples";
import { Image, MessageSquareText, Mic, QrCode, ArrowUpRight } from "lucide-react";
import { useT } from "@/i18n";

const ICONS = { kyc_sms: MessageSquareText, fake_payment: Image, qr_receive: QrCode, digital_arrest: Mic };

interface Props {
  onPick: (example: Example) => void;
  disabled?: boolean;
}

/** Four made-up scams that run through the normal check pipeline with one tap. */
export function ExampleRow({ onPick, disabled }: Props) {
  const t = useT();
  return (
    <section aria-labelledby="examples-title" className="mt-9">
      <h2 id="examples-title" className="text-lg font-semibold">
        {t("examples.title")}
      </h2>
      <p className="mt-2 text-base leading-relaxed text-muted-foreground">{t("examples.hint")}</p>
      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {EXAMPLES.map((ex) => {
          const Icon = ICONS[ex.id];
          return (
            <li key={ex.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onPick(ex)}
                data-example={ex.id}
                className="group flex min-h-24 w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                  <Icon size={22} aria-hidden />
                </span>
                <span className="flex-1 text-base font-semibold leading-relaxed">{t(ex.titleKey)}</span>
                <ArrowUpRight size={18} className="shrink-0 text-muted-foreground" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
