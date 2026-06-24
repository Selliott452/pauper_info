import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { copyFileSync } from "fs";

// `base` is the public path the app is served under. For a GitHub Pages project
// site it must be "/<repo>/"; locally and for root/custom-domain hosting it's "/".
// Set via the VITE_BASE env var at build time (the CI workflow derives it).
const base = process.env.VITE_BASE || "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    {
      // GitHub Pages serves 404.html for unknown paths while keeping the URL,
      // so a copy of index.html lets client-side routes (deep links/refresh) work.
      name: "spa-404-fallback",
      closeBundle() {
        try {
          copyFileSync("dist/index.html", "dist/404.html");
        } catch {
          /* dist/index.html may not exist for non-build commands */
        }
      },
    },
  ],
  // Dev only: proxy /api to the local Spring app so dev stays same-origin.
  server: {
    proxy: {
      "/api": "http://localhost:8080",
    },
  },
});
