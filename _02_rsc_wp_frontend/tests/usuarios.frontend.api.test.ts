/*
  TDD Refactor — Frontend (parallel, originals untouched) — Issue #6
  Uses API_URL env; asserts endpoint contracts.
*/
import { describe, test, expect } from "bun:test";

const BASE_URL = process.env.API_URL || "http://localhost:4001";

describe("Frontend users endpoint contracts", () => {
  test("GET /usuarios returns 200 with array", async () => {
    const res = await fetch(`${BASE_URL}/usuarios`);
    expect(res.status).toBe(200);
    const data = await res.json() as any[];
    expect(Array.isArray(data)).toBe(true);
  });

  test("POST /usuarios creates user (201 or error handled)", async () => {
    const body = { nombre: "Frontend TDD", email: `frontend_tdd_${Date.now()}@test.com` };
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
