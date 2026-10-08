// ======================================================
// DATABASE CONNECTION
// ======================================================


import { Pool } from "pg";
import { readFileSync } from "fs";

// Reads a Docker Compose secret file (mounted read-only at /run/secrets/).
// Falls back to the plain env var for local development without Docker.
function readSecretFile(path: string | undefined, fallback: string): string {
  if (!path) return fallback;
  try {
    return readFileSync(path, "utf-8").trim();
  } catch {
    return fallback;
  }
}

const dbPassword = readSecretFile(
  process.env.DB_PASSWORD_FILE,
  process.env.DB_PASSWORD || "",
);
const dbUser = readSecretFile(process.env.DB_USER_FILE, process.env.DB_USER || "admin");

export const db = new Pool({
  host: process.env.DB_HOST || "postgres",
  port: Number(process.env.DB_PORT) || 5432,
  user: dbUser,
  password: dbPassword,
  database: process.env.DB_NAME || "wpm_db",
});