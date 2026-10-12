import type { ITest }
from "../interfaces/ITest";

import type { TTestResult } from "../../core/types/TTestResult";

import { apiBaseUrl }
from "../../core/config/apiConfig";

export class InvalidRouteTest
implements ITest {

  async run():
  Promise<TTestResult> {

    const response =
      await fetch(
        `${apiBaseUrl()}/ruta-inexistente`
      );

    const data =
      await response.json();

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