import type { ITest }
from "../interfaces/ITest";

import  type { TTestResult }
from "../../core/types/TTestResult";

import { UsuarioApiService }
from "../services/UsuarioApiService";

export class GetUsuariosTest
implements ITest {

  constructor(

    private readonly api:
      UsuarioApiService

  ) {}

  async run():
  Promise<TTestResult> {

    const response =
      await this.api.getUsuarios();

    const data =
      await response.json();

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