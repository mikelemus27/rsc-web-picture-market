import type { ITest }
from "../interfaces/ITest";

import type { TTestResult } from "../../core/types/TTestResult";

export class InvalidRouteTest
implements ITest {

  async run():
  Promise<TTestResult> {

    const response =
      await fetch(
        "http://localhost:3000/ruta-inexistente"
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