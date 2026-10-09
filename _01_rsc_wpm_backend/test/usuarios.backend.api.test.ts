/*
  TDD Refactor — parallel test (original files untouched)
  Issue #4: Refactor TDD Test Suite for Backend
  Best-fit name: usuarios.api.test.ts (matches /usuarios endpoint + UsuarioService)
  Uses TEST_URL env; asserts status codes.
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
      email: `api_test_${crypto.randomUUID()}@test.com`,
    }),
  });
  expect(response.status).toBe(201);
  return await response.json() as Usuario;
}

async function cleanupTestUser(id: number): Promise<void> {
  const response = await fetch(`${BASE_URL}/usuarios/${id}`, { method: "DELETE" });
  expect([200, 404]).toContain(response.status);
}

describe("Backend API — usuarios (parallel TDD)", () => {
  test(`GET ${BASE_URL}/health reports API readiness`, async () => {
    const response = await fetch(`${BASE_URL}/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  test(`GET ${BASE_URL}/usuarios returns 200 with array`, async () => {
    const res = await fetch(`${BASE_URL}/usuarios`);
    expect(res.status).toBe(200);
    const data = await res.json() as any[];
    expect(Array.isArray(data)).toBe(true);
  });

  test(`POST ${BASE_URL}/usuarios creates user with a unique email`, async () => {
    const body = { nombre: "TDD User", email: `tdd_${crypto.randomUUID()}@test.com` };
    const res = await fetch(`${BASE_URL}/usuarios`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(res.status).toBe(201);
    const created = await res.json() as Usuario;
    await cleanupTestUser(created.id);
  });

  test(`POST ${BASE_URL}/usuarios returns 409 when the email already exists`, async () => {
    const body = { nombre: "TDD Duplicate", email: `duplicate_${crypto.randomUUID()}@test.com` };
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
      body: JSON.stringify({ nombre: "TDD User" }),
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
    const created = await createTestUser("Backend API GET by ID");
    try {
      const response = await fetch(`${BASE_URL}/usuarios/${created.id}`);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(created);
    } finally {
      await cleanupTestUser(created.id);
    }
  });

  test(`PUT ${BASE_URL}/usuarios/:id updates and persists user fields`, async () => {
    const created = await createTestUser("Backend API update before");
    const updated = {
      id: created.id,
      nombre: "Backend API update after",
      email: `api_updated_${crypto.randomUUID()}@test.com`,
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

  test(`PUT ${BASE_URL}/usuarios/:id returns 400 when the email is invalid`, async () => {
    const created = await createTestUser("Backend API invalid email");
    try {
      const response = await fetch(`${BASE_URL}/usuarios/${created.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: "Backend API invalid email", email: "not-an-email" }),
      });
      expect(response.status).toBe(400);
    } finally {
      await cleanupTestUser(created.id);
    }
  });

  test(`PUT ${BASE_URL}/usuarios/:id returns 404 when the user does not exist`, async () => {
    const created = await createTestUser("Backend API gone");
    await cleanupTestUser(created.id);
    const response = await fetch(`${BASE_URL}/usuarios/${created.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: "Backend API gone", email: `gone_${crypto.randomUUID()}@test.com` }),
    });
    expect(response.status).toBe(404);
  });

  test(`DELETE ${BASE_URL}/usuarios/:id removes the user`, async () => {
    const created = await createTestUser("Backend API delete");
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

  test(`GET ${BASE_URL}/ruta-inexistente returns 404`, async () => {
    const res = await fetch(`${BASE_URL}/ruta-inexistente`);
    expect(res.status).toBe(404);
  });

  test(`GET ${BASE_URL}/usuarios/abc returns 400 (invalid id)`, async () => {
    const res = await fetch(`${BASE_URL}/usuarios/abc`);
    expect(res.status).toBe(400);
  });
});
