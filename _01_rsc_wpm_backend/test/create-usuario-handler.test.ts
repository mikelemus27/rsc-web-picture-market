import { describe, expect, spyOn, test } from "bun:test";
import { UsuarioAlreadyExistsError } from "../src/aplicacion/errors/UsuarioAlreadyExistsError";
import { UsuarioDTO } from "../src/aplicacion/dto/UsuarioDTO";
import { UsuarioValidationError } from "../src/dominio/errors/UsuarioValidationError";
import { handleCreateUsuario } from "../src/infraestructura/adaptadores/input/http/CreateUsuarioHandler";

const request = (body: unknown) =>
  new Request("http://localhost/usuarios", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("create-user HTTP handler", () => {
  test("returns 201 when a valid user is created", async () => {
    const response = await handleCreateUsuario(
      request({ nombre: "Ada Lovelace", email: "ada@example.com" }),
      async ({ nombre, email }) => new UsuarioDTO(1, nombre, email),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      id: 1,
      nombre: "Ada Lovelace",
      email: "ada@example.com",
    });
  });

  test("returns 400 for malformed create-user input", async () => {
    const createUsuario = async () => {
      throw new Error("Should not call create for invalid input");
    };

    const response = await handleCreateUsuario(
      request({ nombre: 7, email: "ada@example.com" }),
      createUsuario,
    );

    expect(response.status).toBe(400);
  });

  test("returns 409 when the email already exists", async () => {
    const response = await handleCreateUsuario(
      request({ nombre: "Ada Lovelace", email: "ada@example.com" }),
      async () => {
        throw new UsuarioAlreadyExistsError("El email ya existe");
      },
    );

    expect(response.status).toBe(409);
  });

  test("returns 400 for a domain validation error", async () => {
    const response = await handleCreateUsuario(
      request({ nombre: "A", email: "a@example.com" }),
      async () => {
        throw new UsuarioValidationError("El nombre debe tener al menos 2 caracteres");
      },
    );

    expect(response.status).toBe(400);
  });

  test("returns a generic 500 for unexpected errors", async () => {
    const errorLog = spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await handleCreateUsuario(
        request({ nombre: "Ada Lovelace", email: "ada@example.com" }),
        async () => {
          throw new Error("database connection details");
        },
      );
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: "Internal Server Error" });
      expect(errorLog).toHaveBeenCalled();
    } finally {
      errorLog.mockRestore();
    }
  });
});
