// Shared helpers for rendering with Remotion's Node API (one bundle, many stills / one render).
import { bundle } from "@remotion/bundler";
import { selectComposition } from "@remotion/renderer";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Reuse the Chromium that Playwright downloaded (no second browser download). */
export function browserExecutable() {
  const cache = join(homedir(), "Library/Caches/ms-playwright");
  if (!existsSync(cache)) return null;
  for (const dir of readdirSync(cache).filter((d) => d.startsWith("chromium_headless_shell")).sort().reverse()) {
    for (const rel of ["chrome-headless-shell-mac-arm64/chrome-headless-shell", "chrome-mac/headless_shell"]) {
      const p = join(cache, dir, rel);
      if (existsSync(p)) return p;
    }
  }
  return null;
}

export async function getBundle() {
  return bundle({ entryPoint: join(ROOT, "src/index.ts"), publicDir: join(ROOT, "public"), onProgress: () => {} });
}

export async function getComposition(serveUrl) {
  return selectComposition({ serveUrl, id: "ScamShieldDemo", browserExecutable: browserExecutable() });
}
