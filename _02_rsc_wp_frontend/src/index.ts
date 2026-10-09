
import { HttpClient } from "./core/http/HttpClient";
import { ConsolePrinter } from "./core/console/ConsolePrinter";
import { TablePrinter } from "./core/console/TablePrinter";
import { UsuarioApiService } from "./users/services/UsuarioApiService";
import { GetUsuariosTest } from "./users/tests/GetUsuariosTest";
import { CreateUsuarioTest } from "./users/tests/CreateUsuarioTest";
import { UpdateUsuarioTest } from "./users/tests/UpdateUsuarioTest";
import { InvalidRouteTest } from "./users/tests/InvalidRouteTest";
import { TestRunner } from "./app/TestRunner";
import { SummaryReporter } from "./app/SummaryReporter";
import { DeleteUsuarioTest } from "./users/tests/DeleteUsuarioTest";

/*
==================================================
DEPENDENCIAS
==================================================
*/

const httpClient =
  new HttpClient();

const consolePrinter =
  new ConsolePrinter();

const tablePrinter =
  new TablePrinter();

const apiService =
  new UsuarioApiService(
    httpClient,
    process.env.API_URL || "http://localhost:4001"
  );

/*
==================================================
TESTS
==================================================
*/

/*
==================================================
RUNNER
==================================================
*/

const runner =
  new TestRunner(
    consolePrinter
  );

const reporter =
  new SummaryReporter();

/*
==================================================
PROVISIONING
==================================================
*/

async function provisionTestUser(
  api: UsuarioApiService
): Promise<number> {

  const body = {

    nombre: "Provisioned Test User",

    email:
      `provisioned_${Date.now()}@mail.com`

  };

  const response =
    await api.createUsuario(body);

  if (response.status !== 201) {

    throw new Error(
      `Could not provision a test user (HTTP ${response.status})`
    );

  }

  const data =
    await response.json() as { id: number };

  return data.id;

}

/*
==================================================
EJECUCIÓN
==================================================
*/

async function main() {

  consolePrinter.printTitle(
    "🧪 INICIANDO TESTS"
  );

  const provisionedUserId =
    await provisionTestUser(apiService);

  const tests = [

    new GetUsuariosTest(apiService),
    new CreateUsuarioTest(apiService),
    new InvalidRouteTest(),
    new UpdateUsuarioTest(apiService, provisionedUserId)
    ,new DeleteUsuarioTest(apiService, provisionedUserId)

  ];

  const results =
    await runner.runTests(tests);

  tablePrinter.print(results);

  reporter.print(results);

}

main();