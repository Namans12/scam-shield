// Service worker (vite-plugin-pwa, injectManifest): precaches the app shell, never caches /api, and handles
// the Android share target. Compiled separately from the app, so it does not use the DOM-typed globals.
import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { NetworkOnly } from "workbox-strategies";
import { handleShare, SHARE_PATH } from "./share-target/sw-share";

interface Scope {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
  skipWaiting(): Promise<void>;
  caches: CacheStorage;
  addEventListener(type: "message", listener: (event: { data?: { type?: string } }) => void): void;
}
const sw = self as unknown as Scope;

// New workers take over open tabs straight away (the page then shows a "Refresh" prompt, see src/pwa/swUpdate.ts).
void sw.skipWaiting();
clientsClaim();
// A worker that is still waiting (for example installed by an older build) can also be told to take over.
sw.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") void sw.skipWaiting();
});
cleanupOutdatedCaches();
// Must stay the literal `self.__WB_MANIFEST`: the build replaces exactly that text with the precache list.
precacheAndRoute((self as unknown as Scope).__WB_MANIFEST);

// Results are per-user and /api goes to Cloud Run through a Hosting rewrite: always the network.
registerRoute(({ url }) => url.pathname.startsWith("/api/"), new NetworkOnly());
registerRoute(({ url }) => url.pathname === SHARE_PATH, ({ request }) => handleShare(request, sw.caches), "POST");
// Every page navigation (deep links such as /check?example=kyc_sms, /result/:id, /complaint/:id) gets the precached shell.
registerRoute(new NavigationRoute(createHandlerBoundToURL("/index.html"), { denylist: [/^\/api\//] }));
