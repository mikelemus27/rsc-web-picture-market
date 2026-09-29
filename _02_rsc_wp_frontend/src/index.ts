
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

const tests = [

  new GetUsuariosTest( apiService),
  new CreateUsuarioTest(apiService),
  new InvalidRouteTest(),
  new UpdateUsuarioTest(apiService,1)
  ,new DeleteUsuarioTest(apiService,20)
];

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
EJECUCIÓN
==================================================
*/

async function main() {

  consolePrinter.printTitle(
    "🧪 INICIANDO TESTS"
  );

  const results =
    await runner.runTests(tests);

  tablePrinter.print(results);

  reporter.print(results);

}

main();