import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { LinkScan } from "@scam-shield/shared";
import { scanUrl } from "./scan";

export const app = new Hono();

app.get("/healthz", (c) => c.json({ ok: true }));

// Request bodies are tiny ({url}); refuse anything large before parsing.
app.use("/scan", bodyLimit({ maxSize: 16 * 1024, onError: (c) => c.json({ error: "payload too large" }, 413) }));

app.post("/scan", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "body must be JSON" }, 400);
  }
  const url = (body as { url?: unknown } | null)?.url;
  if (typeof url !== "string" || url.length === 0) return c.json({ error: "url (string) is required" }, 400);
  try {
    // Only the URL is taken from the request. Scan options are never client- or environment-controlled.
    return c.json(await scanUrl(url));
  } catch {
    const failed: LinkScan = { requestedUrl: url, redirects: [], blockedReason: "scan_failed" };
    return c.json(failed);
  }
});

app.onError((_err, c) => c.json({ error: "internal error" }, 500));

// Start the HTTP server only when this file is the process entry point (not when imported by tests).
const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(resolve(entry)).href) {
  const port = Number(process.env.PORT) || 8080;
  serve({ fetch: app.fetch, port });
  console.log(`linkscan listening on :${port}`);
}
