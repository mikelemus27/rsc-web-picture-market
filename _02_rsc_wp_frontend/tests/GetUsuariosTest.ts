/*
 * This test checks the API contract for retrieving the full user collection.
 * It uses the shared API service to make the request and returns the HTTP
 * outcome and parsed body in the standard format used by the test runner.
 */
import type { ITest }
from "../interfaces/ITest";

import  type { TTestResult }
from "../../core/types/TTestResult";

import { UsuarioApiService }
from "../services/UsuarioApiService";

export class GetUsuariosTest
implements ITest {

  // Inject the API client so this test remains focused on the endpoint contract,
  // rather than how the HTTP request is constructed.
  constructor(

    private readonly api:
      UsuarioApiService

  ) {}

  async run():
  Promise<TTestResult> {

    // Request the user collection and parse the response body for inclusion in the result.
    const response =
      await this.api.getUsuarios();

    const data =
      await response.json();

    // Mark the test successful only for HTTP 200; retain status and body for reporting and diagnosis.
    return {

      name: "GET /usuarios",

      success:
        response.status === 200,

      status:
        response.status,

      expectedStatus: 200,

      response: data

    };

  }

}