import type { ElementType, ReactNode } from "react";
import type { Lang } from "@scam-shield/shared";
import { translate, useLang, type MessageKey } from "@/i18n";
import { cn } from "@/lib/utils";

const LANGS: Lang[] = ["en", "hi"];

/**
 * Renders the same text in English and Hindi in ONE grid cell and shows only the active language. The cell is always
 * as tall as the taller of the two, so switching language never moves anything around it. The hidden copy is
 * aria-hidden and invisible, and keeps its own language's type size and line height.
 */
export function LangStack({ as: Tag = "span", className, id, fit = false, children }: { as?: ElementType; className?: string; id?: string; fit?: boolean; children: (lang: Lang) => ReactNode }) {
  const { lang } = useLang();
  return (
    <Tag id={id} className={cn("lang-stack", fit && "lang-fit", className)}>
      {LANGS.map((l) => (
        <span key={l} className="lang-slot" lang={l} data-active={l === lang} aria-hidden={l === lang ? undefined : true}>
          {children(l)}
        </span>
      ))}
    </Tag>
  );
}

/** A translated string in both languages (see LangStack). `fit` is for single-line labels: the hidden copy keeps the height but takes no width. */
export function LangText({ k, vars, as, className, fit = false }: { k: MessageKey; vars?: Record<string, string | number>; as?: ElementType; className?: string; fit?: boolean }) {
  return <LangStack as={as} className={className} fit={fit}>{(l) => translate(l, k, vars)}</LangStack>;
}
