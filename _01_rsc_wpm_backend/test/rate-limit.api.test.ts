import { afterAll, describe, expect, test } from "bun:test";
import {
  createRateLimiter,
  tooManyRequestsResponse,
} from "../src/infraestructura/adaptadores/input/http/RateLimiter";

/*
  HTTP-level proof of the wiring used in src/index.ts: every non-health
  request checks the limiter by client IP before routing.
*/

const limiter = createRateLimiter({ max: 2, windowMs: 60_000 });

const server = Bun.serve({
  port: 0,
  fetch(req) {
    const decision = limiter.check(server.requestIP(req)?.address ?? "unknown");
    if (!decision.allowed) {
      return tooManyRequestsResponse(decision.retryAfterMs);
    }
    return new Response("ok");
  },
});

const BASE_URL = `http://localhost:${server.port}`;

afterAll(() => {
  server.stop();
});

describe("rate limit HTTP wiring", () => {
  test("returns 200, 200, then 429 for the same client IP", async () => {
    const statuses: number[] = [];

    for (let i = 0; i < 3; i++) {
      const response = await fetch(`${BASE_URL}/anything`);
      statuses.push(response.status);

      if (response.status === 429) {
        const body = (await response.json()) as {
          error?: unknown;
          retryAfterMs?: unknown;
        };
        expect(body.error).toBe("Too Many Requests");
        expect(typeof body.retryAfterMs).toBe("number");

        const retryAfter = response.headers.get("Retry-After");
        expect(retryAfter).not.toBeNull();
        expect(Number(retryAfter)).toBeGreaterThanOrEqual(1);
      }
    }

    expect(statuses).toEqual([200, 200, 429]);
  });
});