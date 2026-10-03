/*
  These tests verify the external contract of the frontend-facing user API.
  The goal is to confirm that the app responds consistently to expected and invalid requests,
  while keeping the test suite focused on API behavior rather than frontend rendering details.

  This file follows a TDD-style contract check: it asserts status codes and response shapes
  for the key endpoints used by the frontend, without changing the original implementation.
*/
import { describe, test, expect } from "bun:test";

// Use localhost only when no API_URL was configured, as in a local test run.
const LOCAL_BASE_URL = "http://localhost:4001";
// Remove surrounding whitespace and trailing slashes so endpoint paths can be appended consistently.
const CONFIGURED_BASE_URL = process.env.API_URL?.trim().replace(/\/+$/, "");
const BASE_URL = CONFIGURED_BASE_URL || LOCAL_BASE_URL;
const parsedBaseUrl = new URL(BASE_URL);
if (parsedBaseUrl.protocol !== "http:" && parsedBaseUrl.protocol !== "https:") {
  throw new Error("API_URL must use http:// or https://");
}

type Usuario = {
  id: number;
  nombre: string;
  email: string;
};

async function createTestUser(nombre: string): Promise<Usuario> {
  const response = await fetch(`${BASE_URL}/usuarios`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nombre,
      email: `frontend_api_test_${crypto.randomUUID()}@test.com`,
    }),
  });
  expect(response.status).toBe(201);
  return await response.json() as Usuario;
}

async function cleanupTestUser(id: number): Promise<void> {
  const response = await fetch(`${BASE_URL}/usuarios/${id}`, { method: "DELETE" });
  expect([200, 404]).toContain(response.status);
}

describe("Frontend users endpoint contracts", () => {
  test(`GET ${BASE_URL}/health reports API readiness`, async () => {
    const response = await fetch(`${BASE_URL}/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  // The frontend expects the users list endpoint to be available and to return a JSON array.
  // This validates the basic contract for reading all users from the API.
  test(`GET ${BASE_URL}/usuarios returns 200 with array`, async () => {
    const res = await fetch(`${BASE_URL}/usuarios`);
    expect(res.status).toBe(200);
    const data = await res.json() as any[];
    expect(Array.isArray(data)).toBe(true);
  });

  // A unique email must create a user; unexpected responses such as HTTP 500 fail this assertion.
  test(`POST ${BASE_URL}/usuarios creates user with a unique email`, async () => {
    const body = { nombre: "Frontend TDD", email: `frontend_tdd_${crypto.randomUUID()}@test.com` };
    const res = await fetch(`${BASE_URL}/usuarios`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(res.status).toBe(201);
    const created = await res.json() as Usuario;
    await cleanupTestUser(created.id);
  });

  // A duplicate is only proven after the first request successfully created the user.
  test(`POST ${BASE_URL}/usuarios returns 409 when the email already exists`, async () => {
    const body = { nombre: "Frontend duplicate", email: `frontend_duplicate_${crypto.randomUUID()}@test.com` };
    const createResponse = await fetch(`${BASE_URL}/usuarios`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(createResponse.status).toBe(201);
    const created = await createResponse.json() as Usuario;

    try {
      const duplicateResponse = await fetch(`${BASE_URL}/usuarios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      expect(duplicateResponse.status).toBe(409);
    } finally {
      await cleanupTestUser(created.id);
    }
  });

  test(`POST ${BASE_URL}/usuarios returns 400 when required data is missing`, async () => {
    const res = await fetch(`${BASE_URL}/usuarios`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: "Frontend TDD" }),
    });
    expect(res.status).toBe(400);
  });

  test(`POST ${BASE_URL}/usuarios returns 400 when fields have invalid types`, async () => {
    const res = await fetch(`${BASE_URL}/usuarios`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: 7, email: "invalid-type@example.com" }),
    });
    expect(res.status).toBe(400);
  });

  test(`GET ${BASE_URL}/usuarios/:id returns the created user`, async () => {
    const created = await createTestUser("Frontend API GET by ID");
    try {
      const response = await fetch(`${BASE_URL}/usuarios/${created.id}`);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(created);
    } finally {
      await cleanupTestUser(created.id);
    }
  });

  test(`PUT ${BASE_URL}/usuarios/:id updates and persists user fields`, async () => {
    const created = await createTestUser("Frontend API update before");
    const updated = {
      id: created.id,
      nombre: "Frontend API update after",
      email: `frontend_api_updated_${crypto.randomUUID()}@test.com`,
    };
    try {
      const response = await fetch(`${BASE_URL}/usuarios/${created.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: updated.nombre, email: updated.email }),
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(updated);

      const readResponse = await fetch(`${BASE_URL}/usuarios/${created.id}`);
      expect(readResponse.status).toBe(200);
      expect(await readResponse.json()).toEqual(updated);
    } finally {
      await cleanupTestUser(created.id);
    }
  });

  test(`DELETE ${BASE_URL}/usuarios/:id removes the user`, async () => {
    const created = await createTestUser("Frontend API delete");
    try {
      const response = await fetch(`${BASE_URL}/usuarios/${created.id}`, {
        method: "DELETE",
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        message: "Usuario eliminado",
        usuario: created,
      });

      const readResponse = await fetch(`${BASE_URL}/usuarios/${created.id}`);
      expect(readResponse.status).toBe(404);
    } finally {
      await cleanupTestUser(created.id);
    }
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
