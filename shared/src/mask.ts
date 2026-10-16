import type { EntityKey } from "./types";

function maskMiddle(s: string, keepStart: number, keepEnd: number): string {
  if (s.length <= keepStart + keepEnd) return s.length <= 1 ? s : s[0] + "X".repeat(s.length - 1);
  return s.slice(0, keepStart) + "X".repeat(s.length - keepStart - keepEnd) + s.slice(s.length - keepEnd);
}

/** Masks an entity key for display. Domains are public so stay unmasked. */
export function maskIdentifier(key: EntityKey): string {
  const i = key.indexOf(":");
  const type = key.slice(0, i);
  const value = key.slice(i + 1);
  switch (type) {
    case "phone": {
      const m = /^\+91(\d+)$/.exec(value);
      if (m) return `+91 ${maskMiddle(m[1], 2, 3)}`;
      const digits = value.replace(/^\+/, "");
      return (value.startsWith("+") ? "+" : "") + maskMiddle(digits, 2, 3);
    }
    case "upi": {
      const at = value.lastIndexOf("@");
      if (at < 0) return maskMiddle(value, 2, 2).replace(/X/g, "*");
      const handle = value.slice(0, at);
      const psp = value.slice(at);
      if (handle.length <= 4) return handle.slice(0, 1) + "*".repeat(Math.max(handle.length - 1, 0)) + psp;
      return handle.slice(0, 2) + "*".repeat(handle.length - 4) + handle.slice(-2) + psp;
    }
    case "acct":
      return value.length <= 4 ? value : "X".repeat(value.length - 4) + value.slice(-4);
    default:
      return value;
  }
}
