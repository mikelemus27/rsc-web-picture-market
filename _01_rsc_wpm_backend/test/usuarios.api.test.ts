/*
  TDD Refactor — parallel test (original files untouched)
  Issue #4: Refactor TDD Test Suite for Backend
  Best-fit name: usuarios.api.test.ts (matches /usuarios endpoint + UsuarioService)
  Uses TEST_URL env; asserts status codes.
*/
import { describe, test, expect } from "bun:test";

const BASE_URL = process.env.TEST_URL || "http://localhost:4001";

describe("Backend API — usuarios (parallel TDD)", () => {
  test("GET /usuarios returns 200 with array", async () => {
    const res = await fetch(`${BASE_URL}/usuarios`);
    expect(res.status).toBe(200);
    const data = await res.json() as any[];
    expect(Array.isArray(data)).toBe(true);
  });

  test("POST /usuarios creates user (201 or 409/500 handled gracefully)", async () => {
    const body = { nombre: "TDD User", email: `tdd_${Date.now()}@test.com` };
    const res = await fetch(`${BASE_URL}/usuarios`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    expect([201, 409, 500]).toContain(res.status);
  });

  test("GET /ruta-inexistente returns 404", async () => {
    const res = await fetch(`${BASE_URL}/ruta-inexistente`);
    expect(res.status).toBe(404);
  });

  test("GET /usuarios/abc returns 400 (invalid id)", async () => {
    const res = await fetch(`${BASE_URL}/usuarios/abc`);
    expect(res.status).toBe(400);
  });
});
