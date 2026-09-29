import type  { ITest }
from "../interfaces/ITest";

import type { TTestResult }
from "../../core/types/TTestResult";

import { UsuarioApiService }
from "../services/UsuarioApiService";

export class GetUserByIDTest
implements ITest {

  constructor(

    private readonly api:UsuarioApiService, private readonly userId: number

  ) {}

  async run():
  Promise<TTestResult> {
    const response =
      await this.api.getUsuarioById(this.userId);
    const data =
      await response.json();
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
