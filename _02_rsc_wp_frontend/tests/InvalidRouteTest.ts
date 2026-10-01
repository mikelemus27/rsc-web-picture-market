/*
 * This test verifies the server's behavior for an unknown route.
 * A request to a deliberately nonexistent path should return HTTP 404,
 * and the parsed response body is preserved for the shared test report.
 */
import type { ITest }
from "../interfaces/ITest";

import type { TTestResult } from "../../core/types/TTestResult";

// Implements the common test contract so the invalid-route check can be run by the test runner.
export class InvalidRouteTest
implements ITest {

  // Perform the request and package the response as a standard test result.
  async run():
  Promise<TTestResult> {

    // This test currently targets the frontend service's local development URL directly.
    const response =
      await fetch(
        "http://localhost:4001/ruta-inexistente"
      );

    // Preserve the response payload in the report to help diagnose unexpected server responses.
    const data =
      await response.json();

    // Only a 404 is considered success: it confirms that unknown paths are not treated as valid routes.
    return {

      name:
        "GET /ruta-inexistente",

      success:
        response.status === 404,

      status:
        response.status,

      expectedStatus: 404,

      response: data

    };

  }

}