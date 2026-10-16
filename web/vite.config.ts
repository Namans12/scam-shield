import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 5173,
    // Dev-only: forward /api to the Cloud Run API service running locally.
    proxy: {
      "/api": {
        target: process.env.DEV_API_URL || "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      // public/manifest.webmanifest is hand-written and linked from index.html;
      // the plugin only generates the service worker.
      manifest: false,
      injectRegister: "auto",
      registerType: "autoUpdate",
      // Own service worker (src/sw.ts) so it can also handle the Android share target.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      injectManifest: {
        // Firestore and Storage are lazy chunks used on a few pages; they are fetched when needed, not precached.
        globIgnores: ["**/firestore-*.js", "**/storage-*.js", "**/index.esm-*.js"],
      },
    }),
  ],
  resolve: {
    alias: { "@": path.resolve(here, "./src") },
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return "react";
          return undefined;
        },
      },
    },
  },
});
