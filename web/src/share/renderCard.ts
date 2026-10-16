// The shareable warning: a short text (always) and a 1080x1350 PNG card (where the browser can share files).
// Only masked identifiers are used, and the wording is "Reported N times", never "confirmed".
import { maskIdentifier } from "@scam-shield/shared/mask";
import type { CheckResult, Lang } from "@scam-shield/shared";
import { scamTypeKey, translate } from "@/i18n";

const MAX_IDS = 3;

function maskedIds(check: CheckResult): string[] {
  const keys = check.entityKeys.length ? check.entityKeys : check.hits.map((h) => h.key);
  return [...new Set(keys.map((k) => maskIdentifier(k)))].slice(0, MAX_IDS);
}

function reportedLine(check: CheckResult, lang: Lang): string {
  const top = Math.max(0, ...check.hits.map((h) => h.reportCount));
  if (top === 0) return "";
  return top === 1 ? translate(lang, "hits.reportedOne") : translate(lang, "hits.reportedMany", { n: top });
}

function siteUrl(origin?: string): string {
  return origin ?? (typeof window !== "undefined" ? window.location.origin : "");
}

/** The lines shown on the card, in order. Shared by the text message and the picture. */
export function warningLines(check: CheckResult, lang: Lang, origin?: string): { header: string; body: string; ids: string; reported: string; todo: string; cta: string; url: string } {
  const ids = maskedIds(check);
  return {
    header: translate(lang, "share.header"),
    body: translate(lang, "share.body", { type: translate(lang, scamTypeKey(check.scam_type === "none" ? "other" : check.scam_type)) }),
    ids: ids.length ? translate(lang, "share.ids", { ids: ids.join(", ") }) : "",
    reported: reportedLine(check, lang),
    todo: translate(lang, "share.todo"),
    cta: translate(lang, "share.cta"),
    url: siteUrl(origin),
  };
}

/** Plain text for WhatsApp / messages. */
export function warningText(check: CheckResult, lang: Lang, origin?: string): string {
  const l = warningLines(check, lang, origin);
  return [`⚠️ ${l.header}`, l.body, l.ids, l.reported ? `${l.reported} · Scam Shield` : "", l.todo, `${l.cta} ${l.url}`.trim()]
    .filter(Boolean)
    .join("\n\n");
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/(\s+)/)) {
      const next = line + word;
      if (line && ctx.measureText(next).width > maxWidth) {
        out.push(line.trimEnd());
        line = word.trimStart();
      } else line = next;
    }
    out.push(line.trimEnd());
  }
  return out;
}

/** Draws the warning as a 1080x1350 PNG. Needs a browser canvas (not available in jsdom). */
export async function renderWarningCard(check: CheckResult, lang: Lang, origin?: string): Promise<Blob> {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  const l = warningLines(check, lang, origin);
  const font = (size: number, weight = 400) => `${weight} ${size}px system-ui, -apple-system, "Segoe UI", "Noto Sans Devanagari", Arial, sans-serif`;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#b91c1c";
  ctx.fillRect(0, 0, W, 220);
  ctx.fillStyle = "#ffffff";
  ctx.font = font(84, 800);
  ctx.textBaseline = "middle";
  ctx.fillText(`⚠️ ${l.header}`, 70, 112);

  let y = 300;
  const block = (text: string, size: number, weight: number, color: string, gap: number) => {
    if (!text) return;
    ctx.font = font(size, weight);
    ctx.fillStyle = color;
    ctx.textBaseline = "alphabetic";
    for (const line of wrap(ctx, text, W - 140)) {
      ctx.fillText(line, 70, y);
      y += Math.round(size * 1.35);
    }
    y += gap;
  };
  block(l.body, 52, 700, "#111827", 30);
  block(l.ids, 46, 600, "#374151", 20);
  block(l.reported, 46, 700, "#b45309", 30);
  block(l.todo, 44, 400, "#111827", 30);

  ctx.fillStyle = "#f3f4f6";
  ctx.fillRect(0, H - 220, W, 220);
  y = H - 140;
  block(l.cta, 38, 400, "#374151", 4);
  block(l.url.replace(/^https?:\/\//, ""), 46, 700, "#1d4ed8", 0);

  return new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"));
}
