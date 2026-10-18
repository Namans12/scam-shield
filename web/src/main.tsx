import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerServiceWorker } from "./pwa/swUpdate";

// After a deploy, a tab that is still open can ask for a script file that no longer exists: reload once to get the new one.
window.addEventListener("vite:preloadError", () => {
  try {
    if (sessionStorage.getItem("scamshield:reloaded") === "1") return;
    sessionStorage.setItem("scamshield:reloaded", "1");
  } catch {
    // Storage blocked: reload anyway, once per page load is enough.
  }
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

registerServiceWorker();

// Let in-browser AI agents use Scam Shield through WebMCP, where the browser supports it.
if (typeof navigator !== "undefined" && navigator.modelContext) {
  void import("./webmcp/registerTools").then((m) => m.registerScamShieldTools(navigator.modelContext)).catch(() => undefined);
}
