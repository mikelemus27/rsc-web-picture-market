// Single source of the backend port: the root ./.env PORT, exported by
// project-tools/container-management.sh and injected into the container by
// docker-compose.yml (environment.PORT). This is the only place the frontend
// keeps a fallback port.
const DEFAULT_API_HOST = "localhost";
const DEFAULT_API_PORT = "4001";

/**
 * Base URL of the backend API, with no trailing slash.
 *
 * Precedence:
 *   1. API_URL   — an explicit full override (scheme + host + port).
 *   2. API_HOST + PORT — the host is injected by Compose; the port comes from
 *      the root ./.env single source.
 *   3. localhost + the fallback port, so a bare local run with no env works.
 */
export function apiBaseUrl(): string {
  const explicit = process.env.API_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const host = process.env.API_HOST?.trim() || DEFAULT_API_HOST;
  const port = process.env.PORT?.trim() || DEFAULT_API_PORT;
  return `http://${host}:${port}`;
}
