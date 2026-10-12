import { HttpClient } from "./core/http/HttpClient";
import { ConsolePrinter } from "./core/console/ConsolePrinter";
import { TablePrinter } from "./core/console/TablePrinter";
import { UsuarioApiService } from "./users/services/UsuarioApiService";
import { CreateUsuarioTest } from "./users/tests/CreateUsuarioTest";
import { apiBaseUrl }
from "./core/config/apiConfig";

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
    apiBaseUrl()
  );

/*
==================================================
TEST
==================================================
*/

const createUserTest = new CreateUsuarioTest(apiService);

/*
==================================================
EJECUCIÓN
==================================================
*/

async function main() {

  consolePrinter.printTitle(
    "🧪 INICIANDO CREACIÓN DE USUARIO"
  );

  createUserTest.run().then((result) => {
    consolePrinter.printData(
      "Resultado de POST /usuarios:",
      result
    );
  }).catch((error) => {
    consolePrinter.printError(
      `Error en POST /usuarios: ${error}`
    );
  });
}

main();
