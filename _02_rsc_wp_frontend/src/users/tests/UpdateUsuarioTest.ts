import type { ITest } from "../interfaces/ITest";
import type { TTestResult } from "../../core/types/TTestResult";
import { UsuarioApiService } from "../services/UsuarioApiService";
import { ConsolePrinter } from "../../core/console/ConsolePrinter";
export class UpdateUsuarioTest implements ITest {

    private readonly operationame = "PUT /usuarios/:id";
  constructor( private readonly api:UsuarioApiService, private readonly id: number) {}
  async run():Promise<TTestResult> {
     const printer= new ConsolePrinter();
    let success = false;
    const body = {nombre: "Usuario Test Actualizado",email: `testActualizado_${Date.now()}@mail.com`};
    const response = await this.api.updateUsuario(this.id, body);
  let data: unknown = null;
    const text = await response.text();
   
    if (text.length>2) {  //text tiene 2 llaves vacías {} cuando no hay datos, así que verificamos que tenga más de 2 caracteres para considerar que es una respuesta válida
        success = true;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    else {
        success = false;
        data = "No se recibió respuesta del servidor";
        return {
      name: "PUT /usuarios/:id"
      ,success: success
      ,status: response.status
      ,expectedStatus: 200
      ,response: data
    };
    }
  
    /*==========================================
    VALIDAR RESULTADO
    ==========================================*/
   /*==========================================  
    USUARIO Actualizado
      ==========================================*/
    if (response.status === 200) {
        success = true;
        printer.printSuccess(`Usuario ${this.id} Actualizado correctamente` );}
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
   // console.log(response);
    return {
      name: "PUT /usuarios/:id"
      ,success: success
      ,status: response.status
      ,expectedStatus: 200
      ,response: data

    };
}
}