// Android/Chrome "Share to Scam Shield": the OS sends a multipart POST to /share-target. The service worker
// parks the shared text/link/file in Cache Storage and redirects to /?shared=1, where CheckPage picks it up,
// clears it and starts the check. Nothing is sent to a server by this step.

export const SHARE_PATH = "/share-target";
export const CACHE_NAME = "scamshield-share";
const PAYLOAD_KEY = "/shared-payload";
const FILE_KEY = "/shared-payload-file";

export interface SharedPayload { text?: string; url?: string; file?: File }

const URL_RE = /https?:\/\/[^\s<>"']+/i;

/** WhatsApp and most apps put links inside `text`, not `url`, so pull the first one out. */
export function parseSharedForm(fd: FormData): SharedPayload {
  const field = (name: string) => {
    const v = fd.get(name);
    return typeof v === "string" ? v.trim() : "";
  };
  const title = field("title");
  const body = field("text");
  let url = field("url");
  const text = title && body && !body.includes(title) ? `${title}\n${body}` : body || title;
  if (!url) {
    const m = URL_RE.exec(text);
    if (m) url = m[0].replace(/[.,;:!?)\]]+$/, "");
  }
  const media = fd.get("media");
  const out: SharedPayload = {};
  if (text) out.text = text;
  if (url) out.url = url;
  if (media instanceof File && media.size > 0) out.file = media;
  return out;
}

/** Service worker side: store the share and redirect to the app. */
export async function handleShare(request: Request, cacheStorage: CacheStorage): Promise<Response> {
  const dest = new URL("/?shared=1", request.url);
  try {
    const payload = parseSharedForm(await request.formData());
    const cache = await cacheStorage.open(CACHE_NAME);
    await cache.delete(PAYLOAD_KEY);
    await cache.delete(FILE_KEY);
    await cache.put(PAYLOAD_KEY, new Response(JSON.stringify({ text: payload.text, url: payload.url, file: payload.file ? { name: payload.file.name, type: payload.file.type } : null })));
    if (payload.file) await cache.put(FILE_KEY, new Response(payload.file, { headers: { "content-type": payload.file.type } }));
  } catch {
    // A malformed share just opens the app empty.
  }
  return Response.redirect(dest.href, 303);
}

/** Page side: read the parked share once and delete it. */
export async function takeSharedPayload(cacheStorage: CacheStorage): Promise<SharedPayload | null> {
  try {
    const cache = await cacheStorage.open(CACHE_NAME);
    const res = await cache.match(PAYLOAD_KEY);
    if (!res) return null;
    const meta = (await res.json()) as { text?: string; url?: string; file?: { name: string; type: string } | null };
    const out: SharedPayload = {};
    if (meta.text) out.text = meta.text;
    if (meta.url) out.url = meta.url;
    if (meta.file) {
      const f = await cache.match(FILE_KEY);
      if (f) out.file = new File([await f.blob()], meta.file.name || "shared", { type: meta.file.type });
    }
    await cache.delete(PAYLOAD_KEY);
    await cache.delete(FILE_KEY);
    return out;
  } catch {
    return null;
  }
}
