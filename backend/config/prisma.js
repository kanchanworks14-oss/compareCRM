// config/prisma.js — single shared PrismaClient instance
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// Load backend/.env by absolute path so the server works from any working
// directory. Without DATABASE_URL, pg silently falls back to localhost:5432.
dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env") });
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set — check backend/.env (format: DATABASE_URL=postgresql://...)");
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

const prisma = new PrismaClient({ adapter });

export default prisma;
