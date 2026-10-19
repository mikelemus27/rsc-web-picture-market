export type CorsPolicy = {
  readonly allowedOrigins: readonly string[];
  isAllowed(origin: string | null): boolean;
  headersFor(origin: string | null): Record<string, string>;
  preflight(origin: string | null): Response;
};

type CorsPolicyOptions = {
  allowedOrigins?: readonly string[];
};

function originAllowed(
  allowedOrigins: readonly string[],
  origin: string | null,
): boolean {
  if (!origin) {
    return false;
  }
  if (allowedOrigins.includes("*")) {
    return true;
  }
  return allowedOrigins.includes(origin);
}

function corsHeaders(
  allowedOrigins: readonly string[],
  origin: string | null,
): Record<string, string> {
  if (!origin) {
    return {};
  }
  if (!originAllowed(allowedOrigins, origin)) {
    return { Vary: "Origin" };
  }
  const allowValue = allowedOrigins.includes("*") ? "*" : origin;
  return { "Access-Control-Allow-Origin": allowValue, Vary: "Origin" };
}

function varyIncludesOrigin(value: string): boolean {
  return value
    .split(",")
    .some(token => token.trim().toLowerCase() === "origin");
}

export function parseAllowedOrigins(raw: string | undefined | null): string[] {
  if (!raw) {
    return [];
  }

  const seen = new Set<string>();
  const origins: string[] = [];

  for (const entry of raw.split(",")) {
    const origin = entry.trim();
    if (origin && !seen.has(origin)) {
      seen.add(origin);
      origins.push(origin);
    }
  }

  return origins;
}

export function createCorsPolicy(
  options: CorsPolicyOptions = {},
): CorsPolicy {
  const allowedOrigins = Object.freeze([...(options.allowedOrigins ?? [])]);

  return {
    allowedOrigins,

    isAllowed(origin: string | null): boolean {
      return originAllowed(allowedOrigins, origin);
    },

    headersFor(origin: string | null): Record<string, string> {
      return corsHeaders(allowedOrigins, origin);
    },

    preflight(origin: string | null): Response {
      const headers = corsHeaders(allowedOrigins, origin);
      if (originAllowed(allowedOrigins, origin)) {
        headers["Access-Control-Allow-Methods"] =
          "GET, POST, PUT, DELETE, OPTIONS";
        headers["Access-Control-Allow-Headers"] = "Content-Type";
        headers["Access-Control-Max-Age"] = "600";
      }
      return new Response(null, { status: 204, headers });
    },
  };
}

export function applyCorsHeaders(
  response: Response,
  headers: Record<string, string>,
): Response {
  const entries = Object.entries(headers);
  if (entries.length === 0) {
    return response;
  }

  const merged = new Headers(response.headers);
  for (const [name, value] of entries) {
    if (name.toLowerCase() === "vary") {
      const existing = merged.get("Vary");
      if (!existing) {
        merged.set("Vary", value);
      } else if (!varyIncludesOrigin(existing)) {
        merged.set("Vary", `${existing}, ${value}`);
      }
      continue;
    }
    merged.set(name, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: merged,
  });
}

export function withCors(
  handler: (req: Request) => Promise<Response> | Response,
  policy: CorsPolicy,
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    const origin = req.headers.get("origin");

    // Preflights are answered here so they never reach the handler — and its
    // rate limiter, which would otherwise let a throttled preflight break the
    // browser before the real request is ever sent.
    if (req.method === "OPTIONS" && origin !== null) {
      return policy.preflight(origin);
    }

    const response = await handler(req);
    return applyCorsHeaders(response, policy.headersFor(origin));
  };
}
