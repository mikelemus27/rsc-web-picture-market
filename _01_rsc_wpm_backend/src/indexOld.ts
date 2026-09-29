import { Client } from "pg";

/*
==================================================
CONFIGURACIÓN POSTGRESQL
==================================================
*/

const client = new Client({
  host: "postgres",
  port: 5432,
  user: "admin",
  password: "REMOVED",
  database: "escuela",
});

/*
==================================================
CONECTAR A POSTGRESQL
==================================================
*/

async function conectarDB() {
  try {
    await client.connect();

    console.log("✅ Conectado a PostgreSQL");

  } catch (error) {

    console.error("❌ Error conectando a PostgreSQL");

    console.error(error);

    process.exit(1);
  }
}

await conectarDB();

/*
==================================================
FUNCIÓN AUXILIAR JSON
==================================================
*/

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

/*
==================================================
SERVIDOR HTTP
==================================================
*/

const server = Bun.serve({

  port: 3000,

  async fetch(req) {

    try {

      /*
      ==============================================
      INFORMACIÓN REQUEST
      ==============================================
      */

      const url = new URL(req.url);

      const pathname = url.pathname;

      const method = req.method;

      console.log(`\n${method} ${pathname}`);

      /*
      ==============================================
      GET /health
      ==============================================
      */

      if (pathname === "/health" && method === "GET") {

        return json({
          status: "ok",
          service: "microservicio-usuarios",
        });
      }

      /*
      ==============================================
      /usuarios
      ==============================================
      */

      if (pathname === "/usuarios") {

        /*
        ==========================================
        GET /usuarios
        ==========================================
        */

        if (method === "GET") {

          const result = await client.query(
            "SELECT * FROM usuarios ORDER BY id;"
          );

          return json(result.rows);
        }

        /*
        ==========================================
        POST /usuarios
        ==========================================
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
          INSERTAR USUARIO
          ======================================
          */

          const result = await client.query(
            `
            INSERT INTO usuarios(nombre, email)
            VALUES($1, $2)
            RETURNING *;
            `,
            [nombre, email]
          );

          return json(result.rows[0], 201);
        }

        /*
        ==========================================
        MÉTODO NO PERMITIDO
        ==========================================
        */

        return json(
          {
            error: "Method Not Allowed",
          },
          405
        );
      }

      /*
      ==============================================
      /usuarios/:id
      ==============================================
      */

      if (pathname.startsWith("/usuarios/")) {

        /*
        ==========================================
        OBTENER ID
        ==========================================
        */

        const idStr = pathname.split("/")[2];

        const id = Number(idStr);

        /*
        ==========================================
        VALIDAR ID
        ==========================================
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
        ==========================================
        GET /usuarios/:id
        ==========================================
        */

        if (method === "GET") {

          const result = await client.query(
            `
            SELECT *
            FROM usuarios
            WHERE id = $1;
            `,
            [id]
          );

          /*
          ======================================
          NO ENCONTRADO
          ======================================
          */

          if (result.rowCount === 0) {

            return json(
              {
                error: "Usuario no encontrado",
              },
              404
            );
          }

          return json(result.rows[0]);
        }

        /*
        ==========================================
        PUT /usuarios/:id
        ==========================================
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

          /*
          ======================================
          ACTUALIZAR USUARIO
          ======================================
          */

          const result = await client.query(
            `
            UPDATE usuarios
            SET
              nombre = $1,
              email = $2
            WHERE id = $3
            RETURNING *;
            `,
            [nombre, email, id]
          );

          /*
          ======================================
          NO ENCONTRADO
          ======================================
          */

          if (result.rowCount === 0) {

            return json(
              {
                error: "Usuario no encontrado",
              },
              404
            );
          }

          return json(result.rows[0]);
        }

        /*
        ==========================================
        DELETE /usuarios/:id
        ==========================================
        */

        if (method === "DELETE") {

          const result = await client.query(
            `
            DELETE FROM usuarios
            WHERE id = $1
            RETURNING *;
            `,
            [id]
          );

          /*
          ======================================
          NO ENCONTRADO
          ======================================
          */

          if (result.rowCount === 0) {

            return json(
              {
                error: "Usuario no encontrado",
              },
              404
            );
          }

          return json({
            message: "Usuario eliminado",
            usuario: result.rows[0],
          });
        }

        /*
        ==========================================
        MÉTODO NO PERMITIDO
        ==========================================
        */

        return json(
          {
            error: "Method Not Allowed",
          },
          405
        );
      }

      /*
      ==============================================
      RUTA NO ENCONTRADA
      ==============================================
      */

      return json(
        {
          error: "Ruta no encontrada",
        },
        404
      );

    } catch (error) {

      /*
      ==============================================
      ERROR INTERNO
      ==============================================
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
