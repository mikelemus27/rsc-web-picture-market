/*
 * This test checks the read-by-ID contract for the users API.
 * It delegates the HTTP request to UsuarioApiService and returns the status
 * and parsed response body in the format expected by the shared test runner.
 */
import type  { ITest }
from "../interfaces/ITest";

import type { TTestResult }
from "../../core/types/TTestResult";

import { UsuarioApiService }
from "../services/UsuarioApiService";

export class GetUserByIDTest
implements ITest {

  // Inject the API service and target ID so the test focuses on the endpoint contract,
  // while the service handles the HTTP request details.
  constructor(

    private readonly api:UsuarioApiService, private readonly userId: number

  ) {}

  async run():
  Promise<TTestResult> {
    // Request the selected user, then parse the body so it can be included in the test result.
    const response =
      await this.api.getUsuarioById(this.userId);
    const data =
      await response.json();

    // This contract considers only HTTP 200 successful; preserve the actual response details for reporting.
    return {
      name: "GET /usuarios/:id",
      success:
        response.status === 200,
      status:
        response.status,
      expectedStatus: 200,
      response: data

    };

  }

}
