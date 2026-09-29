import { HttpClient } from "./core/http/HttpClient";
import { ConsolePrinter } from "./core/console/ConsolePrinter";
import { UsuarioApiService } from "./users/services/UsuarioApiService";
import { GetUserByIDTest } from "./users/tests/GetUserByIDTest";

/*
==================================================
DEPENDENCIAS
==================================================
*/

const httpClient =
  new HttpClient();

const consolePrinter =
  new ConsolePrinter();

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
const getUserById = new GetUserByIDTest(apiService,id);

/*
==================================================
EJECUCIÓN
==================================================
*/

async function main() {

  consolePrinter.printTitle(
    "🧪 INICIANDO CONSULTA POR ID"
  );

  getUserById.run().then((result) => {
    consolePrinter.printData(
      `Resultado de GET /usuarios/${id}:`,
      result
    );
  }).catch((error) => {
    consolePrinter.printError(
      `Error en GET /usuarios/${id}: ${error}`
    );
  });
}

main();
