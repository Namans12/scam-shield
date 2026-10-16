import { useCallback, useSyncExternalStore } from "react";
import type { Lang, ScamType } from "@scam-shield/shared";
import { en, type MessageKey } from "./en";
import { hi } from "./hi";

export type { MessageKey } from "./en";

const STORAGE_KEY = "scamshield:lang";
const dictionaries: Record<Lang, Record<MessageKey, string>> = { en, hi };

function readStored(): Lang | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "en" || v === "hi" ? v : null;
  } catch {
    return null;
  }
}

function detect(): Lang {
  if (typeof window === "undefined") return "en";
  const stored = readStored();
  if (stored) return stored;
  const nav = typeof navigator !== "undefined" ? (navigator.language ?? "") : "";
  return nav.toLowerCase().startsWith("hi") ? "hi" : "en";
}

let current: Lang = detect();
const listeners = new Set<() => void>();

function applyDocumentLang(lang: Lang) {
  if (typeof document !== "undefined") document.documentElement.lang = lang;
}
applyDocumentLang(current);

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Sets the UI language for the whole app (also used by tests outside React). */
export function setLang(next: Lang) {
  if (next === current) return;
  current = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Storage can be blocked (private mode); the choice then lasts for this visit only.
  }
  applyDocumentLang(next);
  listeners.forEach((fn) => fn());
}

/** The UI language, shared by every component and persisted in localStorage. */
export function useLang(): { lang: Lang; setLang(l: Lang): void } {
  const lang = useSyncExternalStore(subscribe, () => current, () => "en" as Lang);
  return { lang, setLang };
}

/** Pure translate function: used by components that take `lang` as a prop. */
export function translate(lang: Lang, key: MessageKey, vars?: Record<string, string | number>): string {
  const template = dictionaries[lang][key] ?? en[key];
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}

export function useT(): (key: MessageKey, vars?: Record<string, string | number>) => string {
  const { lang } = useLang();
  return useCallback((key, vars) => translate(lang, key, vars), [lang]);
}

export function scamTypeKey(type: ScamType): MessageKey {
  return `scamType.${type}`;
}
