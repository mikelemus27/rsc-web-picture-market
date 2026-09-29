
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
  const ListUsers = new GetUsuariosTest( apiService)
/*

==================================================
EJECUCIÓN
==================================================
*/

async function main() {

  consolePrinter.printTitle(
    "🧪 INICIANDO CONSULTA"
  );
ListUsers.run().then((result) => {
  consolePrinter.printData(
    "Resultado de GET /usuarios:",
    result
  );


})  .catch((error) => {

    consolePrinter.printError(
      `Error en GET /usuarios: ${error}`
    );  
  }); 
}

main();