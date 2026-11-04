// frontend/vite.config.js — CRM dashboard.
//
// React source lives in app/ (entry app/index.html → app/src/main.jsx).
// `npm run build` writes index.html and assets/ straight into frontend/
// because backend/server.js serves this folder as-is. Commit the build output.
//
// frontend/forms/ and the legacy form URLs (customer.html, developer.html,
// agent.html, broker.html) are written by the separate public site in
// ../public-forms/ — this build never writes or deletes them.
//
// `npm run dev` serves the source on http://localhost:5173 and proxies /api
// to the backend on :4000, so the session cookie stays same-origin.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: here("./app"),
  base: "./",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:4000" },
  },
  build: {
    outDir: here("."),
    emptyOutDir: false, // outDir also holds the source and forms/; `npm run build` deletes old assets/ only
  },
});
