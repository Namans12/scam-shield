// Service worker registration and update detection.
//
// The worker (src/sw.ts) calls skipWaiting + clientsClaim, so after a deploy the new worker takes over open tabs by
// itself. The page that is already open still runs the old JavaScript, so we tell the person a new version is ready
// and let them refresh when it suits them (never mid-way through a check). A worker that is still "waiting" (an
// older worker that did not skip waiting) is handled too: Refresh asks it to take over, then reloads.
//
// Manual check after a deploy (needs a real browser; jsdom has no service workers):
//  1. Open the site, then DevTools > Application > Service Workers: one worker, "activated and running".
//  2. Deploy (or `vite build` + `vite preview` again) a change; keep the first tab open and focus it again.
//  3. A bar "New version available. Refresh" appears at the bottom; Refresh reloads onto the new build.
//  4. Open /check?example=kyc_sms, /result/x and /complaint/x directly: each loads the app (offline too), not a 404.
//  5. DevTools > Application > Cache Storage: only the newest `workbox-precache-v2-*` cache remains.
import { useCallback, useEffect, useState } from "react";

/** Registers /sw.js after load and re-checks for a newer worker whenever the tab becomes visible again. No-op in dev and tests. */
export function registerServiceWorker(): void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !import.meta.env.PROD) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") reg.update().catch(() => undefined);
        });
      })
      .catch(() => undefined);
  });
}

/** True once a newer version of the app has been installed while this page was open. */
export function useSwUpdate(): { updateReady: boolean; refresh: () => void; dismiss: () => void } {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    const sw = typeof navigator !== "undefined" ? navigator.serviceWorker : undefined;
    if (!sw) return;
    let hadController = !!sw.controller;
    let live = true;
    const flag = () => live && setUpdateReady(true);

    // First install claims the page too (controller goes null -> worker): that is not an update.
    const onControllerChange = () => {
      if (hadController) flag();
      hadController = true;
    };
    sw.addEventListener("controllerchange", onControllerChange);

    const watch = (reg: ServiceWorkerRegistration) => {
      if (reg.waiting && sw.controller) flag();
      reg.addEventListener("updatefound", () => {
        const worker = reg.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && sw.controller) flag();
        });
      });
    };
    sw.getRegistration?.().then((reg) => live && reg && watch(reg), () => undefined);

    return () => {
      live = false;
      sw.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  const refresh = useCallback(() => {
    const sw = navigator.serviceWorker;
    const reload = () => window.location.reload();
    if (!sw?.getRegistration) return reload();
    sw.getRegistration().then(
      (reg) => {
        if (!reg?.waiting) return reload();
        // Wait for the new worker to take control so the reload is served by it; reload anyway if that stalls.
        sw.addEventListener("controllerchange", reload, { once: true });
        setTimeout(reload, 2000);
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
      },
      reload,
    );
  }, []);

  const dismiss = useCallback(() => setUpdateReady(false), []);
  return { updateReady, refresh, dismiss };
}
