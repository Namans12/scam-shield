import { ListChecks } from "lucide-react";
import type { CheckResult } from "@scam-shield/shared";
import { useT, type MessageKey } from "@/i18n";

type Line = { key: MessageKey; vars?: Record<string, string | number> };

function Part({ title, lines }: { title: string; lines: string[] }) {
  if (lines.length === 0) return null;
  return (
    <section>
      <h3 className="mb-1.5 text-base font-semibold">{title}</h3>
      <ul role="list" className="list-disc space-y-1.5 pl-5">
        {lines.map((line) => (
          <li key={line} className="break-anywhere">{line}</li>
        ))}
      </ul>
    </section>
  );
}

/**
 * "How this verdict was reached", collapsed by default. Every line is built from data the result already holds;
 * a line whose data is absent is left out rather than guessed. The limits at the end are plain facts about the tool.
 */
export function HowDecided({ result }: { result: CheckResult }) {
  const t = useT();
  const hits = result.hits ?? [];
  const hardSignals = result.hardSignals ?? [];
  const scan = result.linkScan;
  const scanOpened = !!scan && !scan.blockedReason;
  const keyCount = result.entityKeys?.length ?? 0;

  // (a) What was read.
  const read: Line[] = [];
  if (result.inputKind === "text") read.push({ key: "result.how.read.text" });
  else if (result.inputKind === "link") read.push({ key: "result.how.read.link" });
  else if (result.inputKind === "image") read.push({ key: "result.how.read.image" });
  else if (result.inputKind === "audio") read.push({ key: result.transcript ? "result.how.read.audio" : "result.how.read.audioNoText" });
  if (result.qr) read.push({ key: "result.how.read.qr" });
  if (scan) read.push({ key: scanOpened ? "result.how.read.scan" : "result.how.read.scanBlocked" });
  if (keyCount > 0) read.push({ key: "result.how.read.lookup", vars: { n: keyCount } });

  // (b) What raised or shaped the verdict. Rule checks only ever raise it.
  const shaped: Line[] = [{ key: "result.how.shaped.ai" }];
  if (result.red_flags?.length) shaped.push({ key: "result.how.shaped.flags", vars: { n: result.red_flags.length } });
  if (hardSignals.includes("reported_entity") || hardSignals.includes("multi_reported_entity")) {
    const most = hits.reduce((m, h) => Math.max(m, h.reportCount), 0);
    shaped.push(most > 0
      ? { key: "result.how.shaped.list", vars: { count: t(most === 1 ? "hits.reportedOne" : "hits.reportedMany", { n: most }) } }
      : { key: "result.how.shaped.listPlain" });
  }
  if (hardSignals.includes("qr_pay_disguised_as_receive")) shaped.push({ key: "result.how.shaped.qr" });
  if (scan) {
    shaped.push({ key: scanOpened ? "result.how.shaped.scan" : "result.how.shaped.scanBlocked" });
    if (scanOpened && scan.redirects.length > 0) shaped.push({ key: "result.how.shaped.scanRedirects", vars: { n: scan.redirects.length } });
  }
  shaped.push({ key: "result.how.shaped.rules" });

  // (c) What could make this wrong.
  const wrong: Line[] = [{ key: "result.how.wrong.guidance" }, { key: "result.how.wrong.new" }];
  if (scanOpened) wrong.push({ key: "result.how.wrong.page" });
  wrong.push({ key: "result.how.wrong.ai" });
  if (keyCount > 0) wrong.push({ key: "result.how.wrong.list" });

  const text = (lines: Line[]) => lines.map((l) => t(l.key, l.vars));
  return (
    <details className="mt-6 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <summary className="min-h-11 cursor-pointer content-center text-lg font-semibold">
        <ListChecks size={20} className="mr-2 inline text-primary" aria-hidden />
        {t("result.how.title")}
      </summary>
      <div className="mt-3 flex flex-col gap-5 text-base leading-relaxed">
        <Part title={t("result.how.read")} lines={text(read)} />
        <Part title={t("result.how.shaped")} lines={text(shaped)} />
        <Part title={t("result.how.wrong")} lines={text(wrong)} />
      </div>
    </details>
  );
}
