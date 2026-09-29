import { HttpClient } from "./core/http/HttpClient";
import { ConsolePrinter } from "./core/console/ConsolePrinter";
import { TablePrinter } from "./core/console/TablePrinter";
import { UsuarioApiService } from "./users/services/UsuarioApiService";
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
TEST
==================================================
*/

const deleteUserTest = new DeleteUsuarioTest(apiService, 13);

/*
==================================================
EJECUCIÓN
==================================================
*/

async function main() {

  consolePrinter.printTitle(
    "🧪 INICIANDO ELIMINACIÓN DE USUARIO"
  );

  deleteUserTest.run().then((result) => {
    consolePrinter.printData(
      "Resultado de DELETE /usuarios/1:",
      result
    );
  }).catch((error) => {
    consolePrinter.printError(
      `Error en DELETE /usuarios/1: ${error}`
    );
  });
}

main();
