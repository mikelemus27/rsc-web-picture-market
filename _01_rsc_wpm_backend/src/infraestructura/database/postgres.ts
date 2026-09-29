// ======================================================
// DATABASE CONNECTION
// ======================================================


import { Pool } from "pg";

export const db = new Pool({
  host: process.env.DB_HOST || "postgres",
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || "admin",
  password: process.env.DB_PASSWORD || "REMOVED",
  database: process.env.DB_NAME || "escuela",
});