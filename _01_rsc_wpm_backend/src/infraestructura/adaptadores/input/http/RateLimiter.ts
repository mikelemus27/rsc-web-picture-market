export type RateLimitDecision =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number };

export type RateLimiter = {
  check(key: string): RateLimitDecision;
  size(): number;
};

type RateLimiterOptions = {
  max?: number;
  windowMs?: number;
  now?: () => number;
  maxKeys?: number;
};

type WindowEntry = {
  count: number;
  windowStart: number;
};

function positiveIntOrDefault(value: number, fallback: number): number {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export function createRateLimiter(
  options: RateLimiterOptions = {},
): RateLimiter {
  const max = positiveIntOrDefault(options.max ?? NaN, 100);
  const windowMs = positiveIntOrDefault(options.windowMs ?? NaN, 60_000);
  const now = options.now ?? Date.now;
  const maxKeys = positiveIntOrDefault(options.maxKeys ?? NaN, 4096);
  const buckets = new Map<string, WindowEntry>();

  function sweepExpired(currentMs: number): void {
    if (buckets.size < maxKeys) {
      return;
    }
    for (const [key, entry] of buckets) {
      if (currentMs - entry.windowStart >= windowMs) {
        buckets.delete(key);
      }
    }
  }

  return {
    check(key: string): RateLimitDecision {
      const currentMs = now();
      sweepExpired(currentMs);

      const entry = buckets.get(key);
      if (!entry || currentMs - entry.windowStart >= windowMs) {
        buckets.set(key, { count: 1, windowStart: currentMs });
        return { allowed: true };
      }

      if (entry.count >= max) {
        return {
          allowed: false,
          retryAfterMs: entry.windowStart + windowMs - currentMs,
        };
      }

      entry.count += 1;
      return { allowed: true };
    },

    size(): number {
      return buckets.size;
    },
  };
}

export function tooManyRequestsResponse(retryAfterMs: number): Response {
  const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return new Response(
    JSON.stringify({ error: "Too Many Requests", retryAfterMs }, null, 2),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSeconds),
      },
    },
  );
}