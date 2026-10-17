import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { Check, Copy, ExternalLink, Phone, FileText } from "lucide-react";
import type { CheckResult } from "@scam-shield/shared";
import { buildComplaint } from "@scam-shield/shared/complaint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Disclaimer } from "@/components/Disclaimer";
import { useLang, useT } from "@/i18n";
import { fetchCheck } from "@/data";

/** "5000" and "5,000" become "Rs 5,000"; anything else is kept as typed. */
export function formatAmount(raw: string): string | undefined {
  const v = raw.trim();
  if (!v) return undefined;
  if (/^[\d,]+(\.\d{1,2})?$/.test(v)) {
    const [whole, frac] = v.replace(/,/g, "").split(".");
    return `Rs ${Number(whole).toLocaleString("en-IN")}${frac ? "." + frac : ""}`;
  }
  return v;
}

export default function ComplaintPage() {
  const { id } = useParams();
  const location = useLocation();
  const t = useT();
  const { lang } = useLang();
  const state = location.state as { result?: CheckResult } | null;
  const stateResult = state?.result && state.result.id === id ? state.result : null;
  const [fetched, setFetched] = useState<{ id: string; result: CheckResult | null } | null>(null);
  useEffect(() => {
    if (stateResult || !id) return;
    let live = true;
    fetchCheck(id).then(
      (r) => live && setFetched({ id, result: r }),
      () => live && setFetched({ id, result: null }),
    );
    return () => {
      live = false;
    };
  }, [id, stateResult]);
  const result = stateResult ?? (fetched && fetched.id === id ? fetched.result : null);
  const loading = !stateResult && !!id && !(fetched && fetched.id === id);
  const [amount, setAmount] = useState("");
  const [when, setWhen] = useState("");
  const [copied, setCopied] = useState(false);

  const draft = useMemo(
    () => (result ? buildComplaint(result, { lang, amountLost: formatAmount(amount), incidentAt: when.trim() || undefined }) : ""),
    [result, lang, amount, when],
  );

  if (loading) return <p role="status" className="text-base">{t("result.loading")}</p>;
  if (!result) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <h1 className="text-2xl font-bold">{t("result.gone.title")}</h1>
        <p className="mt-2 text-base text-muted-foreground">{t("result.gone.body")}</p>
        <Button asChild size="lg" className="mt-6">
          <Link to="/check">{t("result.gone.cta")}</Link>
        </Button>
      </div>
    );
  }

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard blocked: the text is selectable in the box below.
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{t("complaint.title")}</h1>
      <p className="mt-3 text-lg leading-relaxed text-muted-foreground">{t("complaint.intro")}</p>

      <div className="mt-6"><Disclaimer /></div>
      <section className="mt-6 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7">
        <h2 className="mb-5 text-xl font-bold tracking-tight">{t("pages.complaint.details")}</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="c-amount" className="mb-2 block text-base font-semibold">
              {t("complaint.amount")}
            </label>
            <Input id="c-amount" inputMode="decimal" autoComplete="off" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <label htmlFor="c-when" className="mb-2 block text-base font-semibold">
              {t("complaint.when")}
            </label>
            <Input id="c-when" autoComplete="off" value={when} placeholder={t("complaint.whenPlaceholder")} onChange={(e) => setWhen(e.target.value)} />
          </div>
        </div>
      </section>
      <section className="mt-6 overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-secondary/40 p-5 sm:px-7">
          <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight"><FileText size={22} className="shrink-0 text-primary" aria-hidden />{t("complaint.draft")}</h2>
          <p className="mt-2 text-base text-muted-foreground">{t("pages.complaint.review")}</p>
        </div>
        <div className="p-4 sm:p-6"><Textarea readOnly value={draft} lang={lang} className="min-h-[28rem] rounded-xl border border-border bg-background/50 text-base leading-relaxed" aria-label={t("complaint.draft")} /></div>
      </section>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button type="button" size="lg" onClick={onCopy}>
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? t("complaint.copied") : t("complaint.copy")}
        </Button>
        <Button asChild size="lg" variant="outline">
          <a href="https://cybercrime.gov.in" target="_blank" rel="noopener noreferrer">
            <ExternalLink aria-hidden />
            {t("complaint.portal")}
          </a>
        </Button>
        <Button asChild size="lg" variant="outline">
          <a href="tel:1930">
            <Phone aria-hidden />
            {t("complaint.call")}
          </a>
        </Button>
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {copied ? t("complaint.copied") : ""}
      </p>

      <div className="mt-6">
        <Button asChild variant="ghost" size="lg">
          <Link to={`/result/${result.id}`} state={{ result }}>
            {t("complaint.back")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
