

// ======================================================
// index.ts
// Arquitectura Hexagonal + Bun + PostgreSQL
// ======================================================

import { db } from "./infraestructura/database/postgres";

import { UsuarioRepositoryImpl }
from "./infraestructura/adaptadores/output/postgres_sql/UsuarioRepositoryImpl";

import { UsuarioService }
from "./aplicacion/services/UsuarioService";

import { UsuarioController }
from "./infraestructura/adaptadores/input/http/UsuarioController";
import { EliminarUsuarioUseCase } from "./aplicacion/caso_uso/usuario/eliminar_usuarios/EliminarUsuarioUseCase";
import { ActualizarUsuarioUseCase } from "./aplicacion/caso_uso/usuario/actualizar_usuarios/ActualizarUsuarioUseCase";
import { CrearUsuarioUseCase } from "./aplicacion/caso_uso/usuario/crear_usuario/CrearUsuarioUseCase";
import { ObtenerUsuarioUseCase } from "./aplicacion/caso_uso/usuario/obtener_usuario/ObtenerUsuarioUseCase";
import { ListarUsuariosUseCase } from "./aplicacion/caso_uso/usuario/listar_usuarios/ListarUsuariosUseCase";
import { CreateUsuarioRequest } from "./aplicacion/dto/CreateUsuarioRequest";
import { ActualizarUsuarioRequest } from "./aplicacion/dto/ActualizarUsuarioRequest";

/*
==================================================
DEPENDENCY INJECTION
==================================================
*/

const usuarioRepository =
  new UsuarioRepositoryImpl(db);
/*
==================================================
USE CASE INSTANCES
==================================================
*/

const crearUsuarioUseCase =
  new CrearUsuarioUseCase(
    usuarioRepository
  );

const obtenerUsuarioUseCase =
  new ObtenerUsuarioUseCase(
    usuarioRepository
  );

const listarUsuariosUseCase =
  new ListarUsuariosUseCase( 
    usuarioRepository
  );

const actualizarUsuarioUseCase =
  new ActualizarUsuarioUseCase(
    usuarioRepository
  );

const eliminarUsuarioUseCase =
  new EliminarUsuarioUseCase(
    usuarioRepository
  );

/*
==================================================
SERVICE INSTANCE
==================================================
*/
const usuarioService =
  new UsuarioService(
    crearUsuarioUseCase,
    obtenerUsuarioUseCase,
    listarUsuariosUseCase,
    actualizarUsuarioUseCase,
    eliminarUsuarioUseCase

  );

const usuarioController =
  new UsuarioController(usuarioService);

/*
==================================================
HELPER JSON RESPONSE
==================================================
*/

function json(data: unknown, status = 200): Response {

  return new Response(
    JSON.stringify(data, null, 2),
    {
      status,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}

/*
==================================================
SERVIDOR
==================================================
*/

const server = Bun.serve({

  port: 4001,

  async fetch(req) {

    try {

      /*
      ==========================================
      REQUEST INFO
      ==========================================
      */

      const url = new URL(req.url);

      const pathname = url.pathname;

      const method = req.method;

      console.log(`\n${method} ${pathname}`);

      /*
      ==========================================
      /usuarios
      ==========================================
      */

      if (pathname === "/usuarios") {

        /*
        ======================================
        GET /usuarios
        ======================================
        */

        if (method === "GET") {
          console.log("dispatchibg  list of users");

          const usuarios =
            await usuarioController.listarUsuarios();

          return json(usuarios);
        }

        /*
        ======================================
        POST /usuarios
        ======================================
        */

        if (method === "POST") {

          const body = (await req.json()) as any;

          const nombre = body?.nombre?.trim();

          const email = body?.email?.trim();

          /*
          ======================================
          VALIDACIONES
          ======================================
          */

          if (!nombre || !email) {

            return json(
              {
                error: "nombre y email son obligatorios",
              },
              400
            );
          }

          /*
          ======================================
          CREAR USUARIO
          ======================================
          */
          try {
            const dtoUser = new CreateUsuarioRequest(nombre, email);
            const usuario =
              await usuarioController.crearUsuario(dtoUser);

            return json(usuario, 201);
          } catch (error: any) {
            const isConflict = error.message?.includes("ya existe");
            return json(
              {
                error: error.message,
              },
              isConflict ? 409 : 400
            );
          }
        }

        /*
        ======================================
        MÉTODO NO PERMITIDO
        ======================================
        */

        return json(
          {
            error: "Method Not Allowed",
          },
          405
        );
      }

      /*
      ==========================================
      /usuarios/id
      ==========================================
      */

      if (pathname.startsWith("/usuarios/")) {

        /*
        ======================================
        OBTENER ID
        ======================================
        */

        const idStr = pathname.split("/")[2];

        const id = Number(idStr);

        /*
        ======================================
        VALIDAR ID
        ======================================
        */

        if (!Number.isInteger(id) || id <= 0) {

          return json(
            {
              error: "ID inválido",
            },
            400
          );
        }

        /*
        ======================================
        GET /usuarios/id
        http://127.0.0.1:3000/usuarios/1
        ======================================
        */

        if (method === "GET") {

          const usuario =
            await usuarioController.obtenerUsuario(id);

          if (!usuario) {

            return json(
              {
                error: "Usuario no encontrado",
              },
              404
            );
          }

          return json(usuario);
        }

        /*
        ======================================
        PUT /usuarios/id
        ======================================
        */

        if (method === "PUT") {

          const body = (await req.json()) as any;

          const nombre = body?.nombre?.trim();

          const email = body?.email?.trim();

          /*
          ======================================
          VALIDACIONES
          ======================================
          */

          if (!nombre || !email) {

            return json(
              {
                error: "nombre y email son obligatorios",
              },
              400
            );
          }

          try {

            const dtoActualiazarUsuario  = new ActualizarUsuarioRequest(id, nombre, email);

            const usuario =
              await usuarioController.actualizarUsuario(dtoActualiazarUsuario);

            return json(usuario);

          } catch (error: any) {

            return json(
              {
                error: error.message,
              },
              404
            );
          }
        }

        /*
        ======================================
        DELETE /usuarios/:id
        ======================================
        */

        if (method === "DELETE") {

          try {

            const usuario =
              await usuarioController.obtenerUsuario(id );

            if (!usuario) {

              return json(
                {
                  error: "Usuario no encontrado",
                },
                404
              );
            }

            await usuarioController.eliminarUsuario(id);

            return json({
              message: "Usuario eliminado",
              usuario,
            });

          } catch (error: any) {

            return json(
              {
                error: error.message,
              },
              500
            );
          }
        }

        /*
        ======================================
        MÉTODO NO PERMITIDO
        ======================================
        */

        return json(
          {
            error: "Method Not Allowed",
          },
          405
        );
      }

      /*
      ==========================================
      RUTA NO ENCONTRADA
      ==========================================
      */

      return json(
        {
          error: "Ruta no encontrada",
        },
        404
      );

    } catch (error) {

      /*
      ==========================================
      ERROR INTERNO
      ==========================================
      */

      console.error("\n❌ ERROR INTERNO");

      console.error(error);

      return json(
        {
          error: "Internal Server Error",
        },
        500
      );
    }
  },
});

/*
==================================================
SERVIDOR INICIADO
==================================================
*/

console.log(`
🚀 Microservicio ejecutándose
🌐 http://localhost:${server.port}
`);

