/*
 * This test exercises the user-update API through the shared test runner.
 * It sends an updated user payload, interprets the response, and returns
 * the HTTP outcome and response data in the runner's standard result format.
 */
import type { ITest } from "../interfaces/ITest";
import type { TTestResult } from "../../core/types/TTestResult";
import { UsuarioApiService } from "../services/UsuarioApiService";
import { ConsolePrinter } from "../../core/console/ConsolePrinter";

// Implements the common test contract so the update check can run with other API tests.
export class UpdateUsuarioTest implements ITest {

    // Describes the endpoint operation; run() uses the same label in its returned result.
    private readonly operationame = "PUT /usuarios/:id";

  // Inject the API service and user ID so the test can focus on response behavior.
  constructor( private readonly api:UsuarioApiService, private readonly id: number) {}

  // Send the update request, interpret its body and status, and return a structured test result.
  async run():Promise<TTestResult> {
     const printer= new ConsolePrinter();
    let success = false;

    // Use a timestamped email so repeated runs are less likely to conflict with an existing user record.
    const body = {nombre: "Usuario Test Actualizado",email: `testActualizado_${Date.now()}@mail.com`};
    const response = await this.api.updateUsuario(this.id, body);

    // Read the body as text first so both JSON responses and non-JSON error bodies can be reported.
  let data: unknown = null;
    const text = await response.text();
   
    // An empty JSON object ("{}") is two characters; this code treats longer bodies as having usable response data.
    if (text.length>2) {
        success = true;
      try {
        // Prefer structured JSON in the test report, but retain plain text if the body is not valid JSON.
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    else {
        success = false;
        data = "No se recibió respuesta del servidor";

        // Return early when the body is empty or only contains "{}"; no response payload is available for normal handling.
        return {
      name: "PUT /usuarios/:id"
      ,success: success
      ,status: response.status
      ,expectedStatus: 200
      ,response: data
    };
    }
  
    // Use HTTP status to determine the final outcome; a response body alone does not prove the update succeeded.
    if (response.status === 200) {
        success = true;
        printer.printSuccess(`Usuario ${this.id} Actualizado correctamente` );}

    // A 404 means the target ID was not found, so the requested update could not be applied.
    else if (response.status === 404) {
         success = false;
          printer.printError(
        `Usuario ${this.id} NO existe`);}

    // Report unexpected statuses and include the parsed or raw body to help diagnose the API response.
    else {
      success = false;
      printer.printError(  `Error inesperado`  );
    printer.printData(
      "Response:",
      data
    );
    }

  
    

    // Return the expected status alongside the actual status and body for the test runner's report.
    return {
      name: "PUT /usuarios/:id"
      ,success: success
      ,status: response.status
      ,expectedStatus: 200
      ,response: data

    };
}
}