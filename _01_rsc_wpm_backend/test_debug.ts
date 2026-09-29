/*
==================================================
SCRIPT DE PRUEBAS Y DEPURACIÓN
MICROSERVICIO CRUD USUARIOS
BUN + TYPESCRIPT
==================================================
*/

const BASE_URL = process.env.TEST_URL || "http://localhost:4001";

/*
==================================================
TIPO RESULTADO
==================================================
*/

type TestResult = {

  test: string;

  success: boolean;

  status: number;

  message: string;

};

/*
==================================================
ARRAY GLOBAL DE RESULTADOS
==================================================
*/

const results: TestResult[] = [];

/*
==================================================
REGISTRAR RESULTADO
==================================================
*/

function addResult(
  test: string,
  success: boolean,
  status: number,
  message: string
): void {

  results.push({
    test,
    success,
    status,
    message
  });

}

/*
==================================================
MOSTRAR RESPUESTA
==================================================
*/

async function logResponse(
  title: string,
  response: Response,
  expectedStatus: number
): Promise<void> {

  const success =
    response.status === expectedStatus;

  const icon =
    success ? "✅" : "❌";

  console.log("\n==================================================");

  console.log(
    `${icon} ${title}`
  );

  console.log("==================================================");

  console.log(
    `📡 STATUS: ${response.status}`
  );

  console.log(
    `🎯 ESPERADO: ${expectedStatus}`
  );

  console.log("\n📥 HEADERS:");

  response.headers.forEach((value, key) => {

    console.log(`  ${key}: ${value}`);

  });

  try {

    const data = await response.clone().json();

    console.log("\n📦 BODY:");

    console.dir(data, {
      depth: null,
      colors: true
    });

    addResult(
      title,
      success,
      response.status,
      JSON.stringify(data)
    );

  } catch {

    console.log(
      "\n⚠️ No se pudo convertir la respuesta a JSON"
    );

    addResult(
      title,
      false,
      response.status,
      "Respuesta inválida"
    );

  }

}

/*
==================================================
GET /
==================================================
*/

async function testRoot(): Promise<void> {

  const response =
    await fetch(`${BASE_URL}/`);

  await logResponse(
    "GET /",
    response,
    200
  );

}

/*
==================================================
GET /usuarios
==================================================
*/

async function testGetUsuarios(): Promise<void> {

  const response =
    await fetch(
      `${BASE_URL}/usuarios`
    );

  await logResponse(
    "GET /usuarios",
    response,
    200
  );

}

/*
==================================================
GET /usuarios/:id
==================================================
*/

async function testGetUsuarioById(
  id: number
): Promise<void> {

  const response =
    await fetch(
      `${BASE_URL}/usuarios/${id}`
    );

  await logResponse(
    `GET /usuarios/${id}`,
    response,
    200
  );

}

/*
==================================================
POST /usuarios
==================================================
*/

async function testCreateUsuario():
Promise<number | null> {

  const body = {

    nombre: "Usuario Test",

    email:
      `test_${Date.now()}@example.com`

  };

  console.log("\n📤 REQUEST BODY:");

  console.dir(body, {
    depth: null,
    colors: true
  });

  const response =
    await fetch(
      `${BASE_URL}/usuarios`,
      {

        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify(body)

      }
    );

  await logResponse(
    "POST /usuarios",
    response,
    201
  );

  try {

    const data =
      (await response.clone().json()) as any;

    return data?.id ?? null;

  } catch {

    return null;

  }

}

/*
==================================================
PUT /usuarios/:id
==================================================
*/

async function testUpdateUsuario(
  id: number
): Promise<void> {

  const body = {

    nombre:
      "Usuario Actualizado",

    email:
      `actualizado_${Date.now()}@example.com`

  };

  console.log("\n📤 REQUEST BODY:");

  console.dir(body, {
    depth: null,
    colors: true
  });

  const response =
    await fetch(
      `${BASE_URL}/usuarios/${id}`,
      {

        method: "PUT",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify(body)

      }
    );

  await logResponse(
    `PUT /usuarios/${id}`,
    response,
    200
  );

}

/*
==================================================
DELETE /usuarios/:id
==================================================
*/

async function testDeleteUsuario(
  id: number
): Promise<void> {

  const response =
    await fetch(
      `${BASE_URL}/usuarios/${id}`,
      {
        method: "DELETE"
      }
    );

  await logResponse(
    `DELETE /usuarios/${id}`,
    response,
    200
  );

}

/*
==================================================
RUTA INEXISTENTE
==================================================
*/

async function testInvalidRoute():
Promise<void> {

  const response =
    await fetch(
      `${BASE_URL}/ruta-inexistente`
    );

  await logResponse(
    "GET /ruta-inexistente",
    response,
    404
  );

}

/*
==================================================
ID INVÁLIDO
==================================================
*/

async function testInvalidId():
Promise<void> {

  const response =
    await fetch(
      `${BASE_URL}/usuarios/abc`
    );

  await logResponse(
    "GET /usuarios/abc",
    response,
    400
  );

}

/*
==================================================
POST INVÁLIDO
==================================================
*/

async function testInvalidPost():
Promise<void> {

  const body = {

    nombre: "",
    email: ""

  };

  console.log("\n📤 REQUEST BODY:");

  console.dir(body, {
    depth: null,
    colors: true
  });

  const response =
    await fetch(
      `${BASE_URL}/usuarios`,
      {

        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify(body)

      }
    );

  await logResponse(
    "POST inválido",
    response,
    400
  );

}

/*
==================================================
RESUMEN FINAL
==================================================
*/

function printSummary(): void {

  console.log(`
==================================================
📋 RESUMEN FINAL DE PRUEBAS
==================================================
`);

  let passed = 0;

  let failed = 0;

  for (const result of results) {

    const icon =
      result.success ? "✅" : "❌";

    console.log(`
${icon} ${result.test}
STATUS: ${result.status}
RESULTADO:
${result.success ? "APROBADA" : "FALLIDA"}
`);

    if (result.success) {

      passed++;

    } else {

      failed++;

    }

  }

  console.log(`
==================================================
📊 ESTADÍSTICAS
==================================================

✅ PRUEBAS APROBADAS: ${passed}

❌ PRUEBAS FALLIDAS: ${failed}

🧪 TOTAL EJECUTADAS: ${results.length}
`);

  if (failed === 0) {

    console.log(`
==================================================
🎉 TODAS LAS PRUEBAS FUERON EXITOSAS
==================================================
`);

  } else {

    console.log(`
==================================================
⚠️ EXISTEN PRUEBAS FALLIDAS
==================================================
`);

  }

}

/*
==================================================
RUN TESTS
==================================================
*/

async function runTests():
Promise<void> {

  console.clear();

  console.log(`
==================================================
🚀 INICIANDO PRUEBAS DEL MICROSERVICIO
==================================================
`);

  try {

    /*
    ==============================================
    ROOT
    ==============================================
    */

    await testRoot();

    /*
    ==============================================
    LISTAR
    ==============================================
    */

    await testGetUsuarios();

    /*
    ==============================================
    CREAR
    ==============================================
    */

    const createdId =
      await testCreateUsuario();

    /*
    ==============================================
    OPERACIONES SOBRE USUARIO
    ==============================================
    */

    if (createdId) {

      await testGetUsuarioById(
        createdId
      );

      await testUpdateUsuario(
        createdId
      );

      await testDeleteUsuario(
        createdId
      );

    }

    /*
    ==============================================
    ERRORES
    ==============================================
    */

    await testInvalidRoute();

    await testInvalidId();

    await testInvalidPost();

    /*
    ==============================================
    RESUMEN
    ==============================================
    */

    printSummary();

  } catch (error) {

    console.log(`
==================================================
❌ ERROR GENERAL EN LAS PRUEBAS
==================================================
`);

    console.error(error);

  }

}

/*
==================================================
EJECUTAR
==================================================
*/

runTests();