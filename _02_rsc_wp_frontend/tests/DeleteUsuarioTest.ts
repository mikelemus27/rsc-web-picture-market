/*
 * This test exercises the user-deletion API through the shared test runner.
 * It delegates the HTTP request to UsuarioApiService, reports the outcome to
 * the console, and returns a structured result for the runner to evaluate.
 */
import type { ITest } from "../interfaces/ITest";
import type { TTestResult } from "../../core/types/TTestResult";
import { UsuarioApiService } from "../services/UsuarioApiService";
import { ConsolePrinter } from "../../core/console/ConsolePrinter";

// Implements the common test contract so deletion can run alongside other API checks.
export class DeleteUsuarioTest implements ITest {

    // This legacy label says PUT, but this class sends and reports a DELETE request; it is not used by run().
    private readonly operationame = "PUT /usuarios/:id";

  // Inject the API client and target user ID so this test does not construct HTTP requests itself.
  constructor( private readonly api:UsuarioApiService, private readonly id: number) {}

  // Send the delete request, report the response, and return the outcome in the format expected by the test runner.
  async run():Promise<TTestResult> {
    let success = false;

    // The service owns the HTTP details; this test focuses on interpreting the endpoint's response.
    const response = await this.api.deleteUsuario(this.id);

    // Keep the parsed response body in the test result for diagnostics, including on error responses.
    const data = await response.json();
    const printer= new ConsolePrinter();

    // Treat HTTP 200 as the successful deletion contract and provide a concise confirmation.
    if (response.status === 200) {
        success = true;
        printer.printSuccess(`Usuario ${this.id} eliminado correctamente` );}

    // A 404 means the requested user was not found, so the deletion test must fail with a specific message.
    else if (response.status === 404) {
         success = false;
          printer.printError(
        `Usuario ${this.id} NO existe`);}

    // Any other status is outside the expected success/not-found cases; report it and print the body for debugging.
    else {
      success = false;
      printer.printError(  `Error inesperado`  );
    printer.printData(
      "Response:",
      data
    );
    }

    // Return both the pass/fail decision and the raw status/body so the runner can display or inspect the result.
    return {
      name: "DELETE /usuarios/:id"
      ,success: success
      ,status: response.status
      ,expectedStatus: 200
      ,response: data

    };
  }
}