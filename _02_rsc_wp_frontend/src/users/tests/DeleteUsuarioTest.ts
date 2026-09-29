
import type { ITest } from "../interfaces/ITest";
import type { TTestResult } from "../../core/types/TTestResult";
import { UsuarioApiService } from "../services/UsuarioApiService";
import { ConsolePrinter } from "../../core/console/ConsolePrinter";
export class DeleteUsuarioTest implements ITest {

    private readonly operationame = "PUT /usuarios/:id";
  constructor( private readonly api:UsuarioApiService, private readonly id: number) {}
  async run():Promise<TTestResult> {
    let success = false;
    const response = await this.api.deleteUsuario(this.id);
    const data = await response.json();
    const printer= new ConsolePrinter();
    /*==========================================
    VALIDAR RESULTADO
    ==========================================*/
   /*==========================================  
    USUARIO ELIMINADO
      ==========================================*/
    if (response.status === 200) {
        success = true;
        printer.printSuccess(`Usuario ${this.id} eliminado correctamente` );}
    /*==========================================
    USUARIO NO EXISTE
    ==========================================*/
    else if (response.status === 404) {
         success = false;
          printer.printError(
        `Usuario ${this.id} NO existe`);}
    /*==========================================
    OTRO ERROR
    ==========================================*/
    else {
      success = false;
      printer.printError(  `Error inesperado`  );
    /*==========================================
    DEBUG DATA
     ==========================================*/
    printer.printData(
      "Response:",
      data
    );
    }
   /*==========================================
    RESULTADO
     ==========================================*/
    //console.log(response);
    return {
      name: "DELETE /usuarios/:id"
      ,success: success
      ,status: response.status
      ,expectedStatus: 200
      ,response: data

    };
  }
}