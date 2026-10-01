// This test verifies the "create user" API flow from the frontend test harness perspective.
// It prepares a valid user payload, sends it to the backend through the service layer,
// and then evaluates whether the API responded with the expected HTTP 201 Created status.
import type { ITest } from "../interfaces/ITest";
import type { TTestResult } from "../../core/types/TTestResult";
import { UsuarioApiService } from "../services/UsuarioApiService";
import { ConsolePrinter } from "../../core/console/ConsolePrinter";

// CreateUsuarioTest is a concrete test implementation that exercises the POST /usuarios endpoint.
// It follows the project’s generic ITest contract and returns a structured result object for reporting.
export class CreateUsuarioTest implements ITest {

  // The test depends on a service abstraction instead of directly using fetch.
  // This keeps the test decoupled from HTTP implementation details and easier to reuse in different environments.
  constructor(private readonly api: UsuarioApiService) {}

  // Run the test by creating a new user payload, calling the API, parsing the response,
  // printing it for debugging, and returning the structured result expected by the test runner.
  async run(): Promise<TTestResult> {

    // Build a valid request body for the user-creation endpoint.
    // The email includes a timestamp so each run generates a unique user and avoids collisions in repeated test executions.
    const body = {
      nombre: "Usuario Test",
      email: `test_${Date.now()}@mail.com`
    };

    // Send the request through the API service abstraction.
    const response = await this.api.createUsuario(body);

    // Parse the response body as JSON so the result object can include the API payload.
    const data = await response.json();

    // Print the created user response for immediate visibility in the console during test runs.
    const printData = new ConsolePrinter();
    printData.printData("Usuario creado:", data);

    return {
      name: "POST /usuarios",

      // The test passes only if the API returns the expected 201 Created status.
      success: response.status === 201,

      // Preserve the raw HTTP status so other reporting layers can inspect the outcome.
      status: response.status,

      // Record the expected status for comparison and documentation purposes.
      expectedStatus: 201,

      // Return the parsed JSON response body to allow diagnostics or downstream assertions.
      response: data
    };
  }
}
