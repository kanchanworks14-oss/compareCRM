// server.js — CRM entrypoint. Serves the API at /api/crm and the frontend
// (../frontend) from the same port, so the whole CRM runs on one URL.
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), ".env") });

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import prisma from "./config/prisma.js";
import crmRoutes from "./routes/crmRoutes.js";
import { HttpError } from "./utils/validate.js";

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const FRONTEND_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "frontend");

// Only these browser origins may call the API (CRM frontend + any website
// pages hosting the public forms). Comma-separated in CORS_ORIGINS.
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:4000")
  .split(",").map((s) => s.trim()).filter(Boolean);
// In development, also accept any localhost port (VS Code preview, Live Server, etc.).
const isDevLocalhost = (origin) =>
  process.env.NODE_ENV !== "production" && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

if (process.env.TRUST_PROXY) app.set("trust proxy", process.env.TRUST_PROXY);
app.disable("x-powered-by");

app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
  });
  next();
});
app.use(cors({
  origin: (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin) || isDevLocalhost(origin)),
  credentials: true,
  allowedHeaders: ["Content-Type", "X-CRM-Request"],
  methods: ["GET", "POST", "PATCH", "OPTIONS"],
}));
app.use(cookieParser());
app.use(express.json({ limit: "50kb" }));

app.get("/api/crm/health", async (req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ ok: true, db: "connected" });
});
app.use("/api/crm", crmRoutes);

// The dashboard and public forms: http://localhost:4000/, /customer.html, ...
// Pages served from here always call the API on this same address.
app.get("/config.js", (req, res) => {
  res.type("application/javascript").send('window.CRM_CONFIG = { apiBase: "/api/crm" };\n');
});
app.use(express.static(FRONTEND_DIR));

app.use((req, res) => res.status(404).json({ error: "Not found." }));

// Central error handler — never leaks stack traces or connection details.
app.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, details: err.details });
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Malformed JSON body." });
  if (err.type === "entity.too.large") return res.status(413).json({ error: "Request body is too large." });
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, err);
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

const connectPrisma = async () => {
  try {
    // $connect() is a no-op with the pg adapter, so run a real query.
    await prisma.$queryRaw`SELECT 1`;
    console.log(`Postgres (Prisma) connected ✅  host: ${new URL(process.env.DATABASE_URL).hostname}`);
  } catch (error) {
    console.error("Postgres (Prisma) error ❌", error.message);
    process.exit(1);
  }
};

const startServer = async () => {
  await connectPrisma();
  // Express 5 also calls this callback with the error; that case is handled below.
  app.listen(PORT, (err) => {
    if (err) return;
    console.log(`CRM server running on port ${PORT}`);
    console.log(`Open the CRM:  http://localhost:${PORT}`);
  }).on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`Port ${PORT} is already in use — the CRM is probably already running in another terminal.`);
      console.error(`Open http://localhost:${PORT}, or close the other terminal (Ctrl + C) and run npm start again.`);
    } else {
      console.error("Server failed to start ❌", err.message);
    }
    process.exit(1);
  });
};

startServer();

process.on("SIGTERM", async () => { await prisma.$disconnect(); process.exit(0); });
process.on("SIGINT", async () => { await prisma.$disconnect(); process.exit(0); });
