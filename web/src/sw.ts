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
}
const sw = self as unknown as Scope;

void sw.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
// Must stay the literal `self.__WB_MANIFEST`: the build replaces exactly that text with the precache list.
precacheAndRoute((self as unknown as Scope).__WB_MANIFEST);

// Results are per-user and /api goes to Cloud Run through a Hosting rewrite: always the network.
registerRoute(({ url }) => url.pathname.startsWith("/api/"), new NetworkOnly());
registerRoute(({ url }) => url.pathname === SHARE_PATH, ({ request }) => handleShare(request, sw.caches), "POST");
registerRoute(new NavigationRoute(createHandlerBoundToURL("/index.html"), { denylist: [/^\/api\//] }));
