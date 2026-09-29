import { HttpClient } from "./core/http/HttpClient";
import { ConsolePrinter } from "./core/console/ConsolePrinter";
import { TablePrinter } from "./core/console/TablePrinter";
import { UsuarioApiService } from "./users/services/UsuarioApiService";
import { UpdateUsuarioTest } from "./users/tests/UpdateUsuarioTest";

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
const id=11;
const updateUserTest = new UpdateUsuarioTest(apiService, id);

/*
==================================================
EJECUCIÓN
==================================================
*/

async function main() {

  consolePrinter.printTitle(
    "🧪 INICIANDO ACTUALIZACIÓN DE USUARIO"
  );

  await updateUserTest.run().then((result) => {
    consolePrinter.printData(
      `Resultado de PUT /usuarios/${id}:`,
      result
    );
  }).catch((error) => {
    consolePrinter.printError(
      `Error en PUT /usuarios/${id}: ${error}`
    );
  });
}

main();
