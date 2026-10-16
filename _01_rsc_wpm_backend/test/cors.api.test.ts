import { afterAll, describe, expect, test } from "bun:test";
import {
  createCorsPolicy,
  withCors,
} from "../src/infraestructura/adaptadores/input/http/Cors";
import {
  createRateLimiter,
  tooManyRequestsResponse,
} from "../src/infraestructura/adaptadores/input/http/RateLimiter";

/*
  HTTP-level proof of the wiring used in src/index.ts: a preflight is answered
  before the rate limiter runs, so it never consumes the client's budget.

  The limiter is keyed by Origin here instead of by IP so each scenario gets its
  own bucket; the composition under test — withCors short-circuiting ahead of
  the guard — is exactly what the production router does.
*/

const ALLOWED_ORIGIN = "http://localhost:3000";
const SECOND_ALLOWED_ORIGIN = "http://localhost:5173";
const BLOCKED_ORIGIN = "http://evil.test";

const policy = createCorsPolicy({
  allowedOrigins: [ALLOWED_ORIGIN, SECOND_ALLOWED_ORIGIN],
});

const limiter = createRateLimiter({ max: 1, windowMs: 60_000 });

const handler = withCors(async (req) => {
  const decision = limiter.check(req.headers.get("origin") ?? "unknown");
  if (!decision.allowed) {
    return tooManyRequestsResponse(decision.retryAfterMs);
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
}, policy);

const server = Bun.serve({ port: 0, fetch: handler });

const BASE_URL = `http://localhost:${server.port}`;

afterAll(() => {
  server.stop();
});

describe("cors HTTP wiring", () => {
  test("echoes an allowed origin on a normal response", async () => {
    const response = await fetch(`${BASE_URL}/usuarios`, {
      headers: { Origin: ALLOWED_ORIGIN },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      ALLOWED_ORIGIN,
    );
    expect(response.headers.get("Vary")).toBe("Origin");
  });

  test("refuses a disallowed origin with only Vary", async () => {
    const response = await fetch(`${BASE_URL}/usuarios`, {
      headers: { Origin: BLOCKED_ORIGIN },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(response.headers.get("Vary")).toBe("Origin");
  });

  test("answers a preflight with 204 and the allow headers", async () => {
    const response = await fetch(`${BASE_URL}/usuarios`, {
      method: "OPTIONS",
      headers: { Origin: ALLOWED_ORIGIN },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      ALLOWED_ORIGIN,
    );
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe(
      "GET, POST, PUT, DELETE, OPTIONS",
    );
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe(
      "Content-Type",
    );
    expect(response.headers.get("Access-Control-Max-Age")).toBe("600");
  });

  test("a preflight does not consume the limiter's budget", async () => {
    const preflight = await fetch(`${BASE_URL}/usuarios`, {
      method: "OPTIONS",
      headers: { Origin: SECOND_ALLOWED_ORIGIN },
    });
    expect(preflight.status).toBe(204);

    const response = await fetch(`${BASE_URL}/usuarios`, {
      headers: { Origin: SECOND_ALLOWED_ORIGIN },
    });
    expect(response.status).toBe(200);

    const second = await fetch(`${BASE_URL}/usuarios`, {
      headers: { Origin: SECOND_ALLOWED_ORIGIN },
    });
    expect(second.status).toBe(429);
  });
});
