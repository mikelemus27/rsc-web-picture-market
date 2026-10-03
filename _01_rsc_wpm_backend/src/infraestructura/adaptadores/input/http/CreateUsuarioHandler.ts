import { UsuarioAlreadyExistsError } from "../../../../aplicacion/errors/UsuarioAlreadyExistsError";
import { CreateUsuarioRequest } from "../../../../aplicacion/dto/CreateUsuarioRequest";
import { UsuarioDTO } from "../../../../aplicacion/dto/UsuarioDTO";
import { UsuarioValidationError } from "../../../../dominio/errors/UsuarioValidationError";

type CreateUsuario = (request: CreateUsuarioRequest) => Promise<UsuarioDTO>;

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function handleCreateUsuario(
  request: Request,
  createUsuario: CreateUsuario,
): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "El cuerpo debe ser JSON válido" }, 400);
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return json({ error: "nombre y email son obligatorios" }, 400);
  }

  const payload = body as Record<string, unknown>;
  if (typeof payload.nombre !== "string" || typeof payload.email !== "string") {
    return json({ error: "nombre y email son obligatorios" }, 400);
  }

  const nombre = payload.nombre.trim();
  const email = payload.email.trim();
  if (!nombre || !email) {
    return json({ error: "nombre y email son obligatorios" }, 400);
  }

  try {
    const usuario = await createUsuario(new CreateUsuarioRequest(nombre, email));
    return json(usuario, 201);
  } catch (error) {
    if (error instanceof UsuarioAlreadyExistsError) {
      return json({ error: error.message }, 409);
    }
    if (error instanceof UsuarioValidationError) {
      return json({ error: error.message }, 400);
    }

    console.error("Unexpected error creating user:", error);
    return json({ error: "Internal Server Error" }, 500);
  }
}
