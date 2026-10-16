import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Let in-browser AI agents use Scam Shield through WebMCP, where the browser supports it.
if (typeof navigator !== "undefined" && navigator.modelContext) {
  void import("./webmcp/registerTools").then((m) => m.registerScamShieldTools(navigator.modelContext)).catch(() => undefined);
}
