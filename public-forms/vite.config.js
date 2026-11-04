// public-forms/vite.config.js — the public enquiry mini website.
//
// One page: /forms/ holds all three forms behind tabs, and
// /forms/?form=customer|developer|agent opens a specific one.
// `npm run build` writes it to ../frontend/forms/, which backend/server.js
// already serves as static files. That folder belongs to this project only:
// it is emptied on every build. The CRM dashboard build never touches it.
//
// The build also writes small redirect pages for every older URL, keeping
// its query string (?propertyId=…&propertyTitle=…):
//   /forms/customer/, /forms/developer/, /forms/agent/   (inside ../frontend/forms/)
//   /customer.html, /developer.html, /agent.html, /broker.html   (inside ../frontend/)
//
// `npm run dev` serves http://localhost:5174/forms/ and proxies /api to the
// CRM backend on :4000.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

// file (relative to ../frontend/) → form it redirects to
const REDIRECTS = {
  "forms/customer/index.html": "customer",
  "forms/developer/index.html": "developer",
  "forms/agent/index.html": "agent",
  "customer.html": "customer",
  "developer.html": "developer",
  "agent.html": "agent",
  "broker.html": "agent", // old Agent form URL
};

const redirectPage = (form) => {
  const target = `/forms/?form=${form}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex">
<title>Redirecting… | Compare Projects</title>
<link rel="canonical" href="${target}">
<script>var q = new URLSearchParams(location.search); q.set("form", ${JSON.stringify(form)}); location.replace("/forms/?" + q + location.hash);</script>
<noscript><meta http-equiv="refresh" content="0;url=${target}"></noscript>
</head>
<body>
<p>This form has moved to <a href="${target}">${target}</a>.</p>
</body>
</html>
`;
};

function redirects() {
  return {
    name: "form-redirects",
    apply: "build",
    closeBundle() {
      for (const [file, form] of Object.entries(REDIRECTS)) {
        const path = here(`../frontend/${file}`);
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, redirectPage(form));
      }
    },
  };
}

export default defineConfig({
  base: "/forms/",
  plugins: [react(), redirects()],
  server: {
    port: 5174,
    proxy: { "/api": "http://localhost:4000" },
  },
  build: {
    outDir: here("../frontend/forms"),
    emptyOutDir: true, // only ever frontend/forms/
  },
});
