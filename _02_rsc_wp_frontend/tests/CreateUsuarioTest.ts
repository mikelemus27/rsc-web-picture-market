import type { ITest } from "../interfaces/ITest";
import type { TTestResult } from "../../core/types/TTestResult";
import { UsuarioApiService } from "../services/UsuarioApiService";
import { ConsolePrinter } from "../../core/console/ConsolePrinter";

export class CreateUsuarioTest implements ITest {

  constructor( private readonly api:UsuarioApiService) {}

  async run():
  Promise<TTestResult> {

    const body = {

      nombre: "Usuario Test",

      email:
        `test_${Date.now()}@mail.com`

    };

    const response =
      await this.api.createUsuario(body);

    const data =
      await response.json();
       const printData= new ConsolePrinter();
       printData.printData("Usuario creado:", data);

    return {

      name: "POST /usuarios",

      success:   
        response.status === 201,

      status:
        response.status,

      expectedStatus: 201,

      response: data

    };

  }

}