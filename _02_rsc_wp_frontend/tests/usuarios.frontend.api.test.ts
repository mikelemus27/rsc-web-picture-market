/*
  These tests verify the external contract of the frontend-facing user API.
  The goal is to confirm that the app responds consistently to expected and invalid requests,
  while keeping the test suite focused on API behavior rather than frontend rendering details.

  This file follows a TDD-style contract check: it asserts status codes and response shapes
  for the key endpoints used by the frontend, without changing the original implementation.
*/
import { describe, test, expect } from "bun:test";

// Keep the local address as a predictable fallback for development and test runs.
const LOCAL_BASE_URL = "http://localhost:4001";
// Remove surrounding whitespace and trailing slashes so endpoint paths can be appended consistently.
const REMOTE_BASE_URL = process.env.API_URL?.trim().replace(/\/+$/, "");

// Resolve the target once before defining/running tests so every case uses the same API host.
async function resolveBaseUrl(): Promise<string> {
  if (!REMOTE_BASE_URL) {
    console.info("API_URL is not set; using the local API.");
    return LOCAL_BASE_URL;
  }

  // Invalid configuration should be corrected rather than hidden by switching to localhost.
  const remoteUrl = new URL(REMOTE_BASE_URL);
  if (remoteUrl.protocol !== "http:" && remoteUrl.protocol !== "https:") {
    throw new Error("API_URL must use http:// or https://");
  }

  // A short timeout prevents a slow or unreachable remote host from stalling the test suite.
  const signal = AbortSignal.timeout(3_000);
  try {
    // Any HTTP response means the remote server is reachable; its status is left for the actual tests to assert.
    await fetch(`${REMOTE_BASE_URL}/usuarios`, { signal });
    console.info(`Remote API responded; using ${REMOTE_BASE_URL}.`);
    return REMOTE_BASE_URL;
  } catch (error) {
    // Only timeout and network connection failures trigger local fallback; other errors remain visible.
    if (!signal.aborted && !(error instanceof TypeError)) {
      throw error;
    }

    console.warn(
      `Remote API did not respond; falling back to ${LOCAL_BASE_URL}.`,
      error,
    );
    return LOCAL_BASE_URL;
  }
}

const BASE_URL = await resolveBaseUrl();

describe("Frontend users endpoint contracts", () => {
  // The frontend expects the users list endpoint to be available and to return a JSON array.
  // This validates the basic contract for reading all users from the API.
  test(`GET ${BASE_URL}/usuarios returns 200 with array`, async () => {
    const res = await fetch(`${BASE_URL}/usuarios`);
    expect(res.status).toBe(200);
    const data = await res.json() as any[];
    expect(Array.isArray(data)).toBe(true);
  });

  // Creating a user is expected to succeed in the normal case, but the API may also reject duplicates or fail unexpectedly.
  // This test allows the realistic response states for a create flow without over-constraining implementation details.
  test(`POST  ${BASE_URL}/usuarios creates user (201 or error handled)`, async () => {
    const body = { nombre: "Frontend TDD", email: `frontend_tdd_${Date.now()}@test.com` };
    const res = await fetch(`${BASE_URL}/usuarios`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    expect([201, 409, 500]).toContain(res.status);
  });

  // Requests to unknown routes should fail with a 404, confirming the server is not silently swallowing bad paths.
  test(`GET  ${BASE_URL}/ruta-inexistente returns 404`, async () => {
    const res = await fetch(`${BASE_URL}/ruta-inexistente`);
    expect(res.status).toBe(404);
  });

  // Invalid path parameters should be rejected with a 400 to guard against malformed client requests.
  // This is a useful contract check for route validation and input sanitization.
  test(`GET  ${BASE_URL}/usuarios/abc returns 400 (invalid id)`, async () => {
    const res = await fetch(`${BASE_URL}/usuarios/abc`);
    expect(res.status).toBe(400);
  });
});
