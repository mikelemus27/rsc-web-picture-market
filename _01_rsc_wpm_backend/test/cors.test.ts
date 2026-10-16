import { describe, expect, test } from "bun:test";
import {
  applyCorsHeaders,
  createCorsPolicy,
  parseAllowedOrigins,
  withCors,
} from "../src/infraestructura/adaptadores/input/http/Cors";

describe("parseAllowedOrigins", () => {
  test("splits on commas and trims each entry", () => {
    expect(
      parseAllowedOrigins("http://localhost:3000,  http://localhost:5173"),
    ).toEqual(["http://localhost:3000", "http://localhost:5173"]);
  });

  test("drops empty entries", () => {
    expect(parseAllowedOrigins("http://a.test,,   ,  http://b.test ,")).toEqual([
      "http://a.test",
      "http://b.test",
    ]);
  });

  test("de-duplicates preserving first-seen order", () => {
    expect(
      parseAllowedOrigins("http://b.test, http://a.test, http://b.test"),
    ).toEqual(["http://b.test", "http://a.test"]);
  });

  test("an absent or blank value yields no origins", () => {
    expect(parseAllowedOrigins(undefined)).toEqual([]);
    expect(parseAllowedOrigins(null)).toEqual([]);
    expect(parseAllowedOrigins("")).toEqual([]);
    expect(parseAllowedOrigins("   ")).toEqual([]);
  });
});

describe("cors policy matching", () => {
  test("allows an exact origin match", () => {
    const policy = createCorsPolicy({
      allowedOrigins: ["http://localhost:3000"],
    });

    expect(policy.isAllowed("http://localhost:3000")).toBe(true);
    expect(policy.isAllowed("http://localhost:3001")).toBe(false);
  });

  test("a wildcard allowlist allows any origin", () => {
    const policy = createCorsPolicy({ allowedOrigins: ["*"] });

    expect(policy.isAllowed("http://anything.test")).toBe(true);
  });

  test("rejects empty origins and an empty allowlist", () => {
    const policy = createCorsPolicy({ allowedOrigins: [] });

    expect(policy.isAllowed("http://localhost:3000")).toBe(false);
    expect(policy.isAllowed(null)).toBe(false);
    expect(policy.isAllowed("")).toBe(false);
  });
});

describe("headersFor", () => {
  test("echoes the matched origin with Vary", () => {
    const policy = createCorsPolicy({
      allowedOrigins: ["http://localhost:3000"],
    });

    expect(policy.headersFor("http://localhost:3000")).toEqual({
      "Access-Control-Allow-Origin": "http://localhost:3000",
      Vary: "Origin",
    });
  });

  test("sends a literal wildcard when the allowlist contains one", () => {
    const policy = createCorsPolicy({ allowedOrigins: ["*"] });

    expect(policy.headersFor("http://anything.test")).toEqual({
      "Access-Control-Allow-Origin": "*",
      Vary: "Origin",
    });
  });

  test("a refused origin only marks the response as origin-dependent", () => {
    const policy = createCorsPolicy({
      allowedOrigins: ["http://localhost:3000"],
    });

    expect(policy.headersFor("http://evil.test")).toEqual({ Vary: "Origin" });
  });

  test("a missing origin carries no CORS headers", () => {
    const policy = createCorsPolicy({
      allowedOrigins: ["http://localhost:3000"],
    });

    expect(policy.headersFor(null)).toEqual({});
    expect(policy.headersFor("")).toEqual({});
  });
});

describe("preflight", () => {
  test("answers an allowed origin with 204 and the allow headers", async () => {
    const policy = createCorsPolicy({
      allowedOrigins: ["http://localhost:3000"],
    });

    const response = policy.preflight("http://localhost:3000");

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://localhost:3000",
    );
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe(
      "GET, POST, PUT, DELETE, OPTIONS",
    );
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe(
      "Content-Type",
    );
    expect(response.headers.get("Access-Control-Max-Age")).toBe("600");
    expect(response.headers.get("Vary")).toBe("Origin");
  });

  test("answers a refused origin with 204 and no allow-origin", () => {
    const policy = createCorsPolicy({
      allowedOrigins: ["http://localhost:3000"],
    });

    const response = policy.preflight("http://evil.test");

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(response.headers.get("Access-Control-Allow-Methods")).toBeNull();
    expect(response.headers.get("Vary")).toBe("Origin");
  });
});

describe("applyCorsHeaders", () => {
  test("keeps existing headers and adds the CORS ones", () => {
    const response = new Response("body", {
      status: 200,
      headers: { "Content-Type": "application/json", "Retry-After": "5" },
    });

    const updated = applyCorsHeaders(response, {
      "Access-Control-Allow-Origin": "http://localhost:3000",
      Vary: "Origin",
    });

    expect(updated.status).toBe(200);
    expect(updated.headers.get("Content-Type")).toBe("application/json");
    expect(updated.headers.get("Retry-After")).toBe("5");
    expect(updated.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://localhost:3000",
    );
  });

  test("appends Origin to an existing Vary without duplicating it", () => {
    const withVary = applyCorsHeaders(
      new Response("body", { headers: { Vary: "Accept-Encoding" } }),
      { Vary: "Origin" },
    );
    expect(withVary.headers.get("Vary")).toBe("Accept-Encoding, Origin");

    const alreadyOrigin = applyCorsHeaders(
      new Response("body", { headers: { Vary: "Origin" } }),
      { Vary: "Origin" },
    );
    expect(alreadyOrigin.headers.get("Vary")).toBe("Origin");
  });

  test("returns the same response when there is nothing to add", () => {
    const response = new Response("body");

    expect(applyCorsHeaders(response, {})).toBe(response);
  });
});

describe("withCors", () => {
  const policy = createCorsPolicy({
    allowedOrigins: ["http://localhost:3000"],
  });

  test("adds CORS headers to a normal response", async () => {
    const handler = withCors(async () => new Response("ok"), policy);

    const response = await handler(
      new Request("http://localhost:4001/usuarios", {
        headers: { Origin: "http://localhost:3000" },
      }),
    );

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://localhost:3000",
    );
    expect(await response.text()).toBe("ok");
  });

  test("answers a preflight itself without running the handler", async () => {
    let called = false;
    const handler = withCors(async () => {
      called = true;
      return new Response("ok");
    }, policy);

    const response = await handler(
      new Request("http://localhost:4001/usuarios", {
        method: "OPTIONS",
        headers: { Origin: "http://localhost:3000" },
      }),
    );

    expect(called).toBe(false);
    expect(response.status).toBe(204);
  });

  test("lets an OPTIONS request without an Origin reach the handler", async () => {
    let called = false;
    const handler = withCors(async () => {
      called = true;
      return new Response("ok", { status: 405 });
    }, policy);

    const response = await handler(
      new Request("http://localhost:4001/usuarios", { method: "OPTIONS" }),
    );

    expect(called).toBe(true);
    expect(response.status).toBe(405);
  });
});
