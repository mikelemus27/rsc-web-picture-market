import { describe, expect, test } from "bun:test";
import {
  createRateLimiter,
  tooManyRequestsResponse,
} from "../src/infraestructura/adaptadores/input/http/RateLimiter";

describe("fixed-window rate limiter", () => {
  test("allows requests under the limit", () => {
    let t = 0;
    const limiter = createRateLimiter({ max: 2, windowMs: 60_000, now: () => t });

    expect(limiter.check("a")).toEqual({ allowed: true });
    expect(limiter.check("a")).toEqual({ allowed: true });
  });

  test("blocks with retryAfterMs equal to the remaining window when the limit is exceeded", () => {
    let t = 0;
    const limiter = createRateLimiter({ max: 2, windowMs: 60_000, now: () => t });

    limiter.check("a");
    limiter.check("a");

    expect(limiter.check("a")).toEqual({ allowed: false, retryAfterMs: 60_000 });
  });

  test("retryAfterMs is the time left in the current window", () => {
    let t = 0;
    const limiter = createRateLimiter({ max: 1, windowMs: 100, now: () => t });

    limiter.check("a");
    t += 40;

    expect(limiter.check("a")).toEqual({ allowed: false, retryAfterMs: 60 });
  });

  test("window expiry resets the counter", () => {
    let t = 0;
    const limiter = createRateLimiter({ max: 2, windowMs: 60_000, now: () => t });

    limiter.check("a");
    limiter.check("a");
    expect(limiter.check("a")).toEqual({ allowed: false, retryAfterMs: 60_000 });

    t += 60_000;

    expect(limiter.check("a")).toEqual({ allowed: true });
  });

  test("keys track independent buckets", () => {
    let t = 0;
    const limiter = createRateLimiter({ max: 1, windowMs: 60_000, now: () => t });

    limiter.check("a");
    expect(limiter.check("a")).toEqual({ allowed: false, retryAfterMs: 60_000 });
    expect(limiter.check("b")).toEqual({ allowed: true });
  });

  test("invalid max falls back to the default of 100", () => {
    let t = 0;
    const limiter = createRateLimiter({ max: NaN, windowMs: 60_000, now: () => t });

    for (let i = 0; i < 100; i++) {
      expect(limiter.check("a")).toEqual({ allowed: true });
    }
    expect(limiter.check("a")).toEqual({ allowed: false, retryAfterMs: 60_000 });
  });

  test("invalid windowMs falls back to the default of 60000", () => {
    let t = 0;
    const limiter = createRateLimiter({ max: 1, windowMs: 0, now: () => t });

    limiter.check("a");
    expect(limiter.check("a")).toEqual({ allowed: false, retryAfterMs: 60_000 });
  });

  test("sweeps expired entries once maxKeys is reached", () => {
    let t = 0;
    const limiter = createRateLimiter({
      max: 5,
      windowMs: 60_000,
      now: () => t,
      maxKeys: 2,
    });

    limiter.check("a"); // t = 0
    t += 60_000;
    limiter.check("b"); // a's window is closed
    t += 60_000;
    limiter.check("c"); // without the sweep the map would hold 3 entries

    expect(limiter.size()).toBeLessThanOrEqual(2);

    t += 60_000;
    expect(limiter.check("fresh")).toEqual({ allowed: true });
    expect(limiter.size()).toBeLessThanOrEqual(2);
  });
});

describe("tooManyRequestsResponse", () => {
  test("returns 429 with a JSON body and a Retry-After header in whole seconds", async () => {
    const response = tooManyRequestsResponse(61_000);

    expect(response.status).toBe(429);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(response.headers.get("Retry-After")).toBe("61");
    expect(await response.json()).toEqual({
      error: "Too Many Requests",
      retryAfterMs: 61_000,
    });
  });

  test("never reports Retry-After below one second", () => {
    const response = tooManyRequestsResponse(250);

    expect(response.headers.get("Retry-After")).toBe("1");
  });
});