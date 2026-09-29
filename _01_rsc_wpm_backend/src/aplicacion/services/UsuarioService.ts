
// ======================================================
// APPLICATION SERVICE / USE CASE
// ======================================================

import type { IUsuarioRepositoryPort } from "../ports/output/IUsuarioRepositoryPort";

import { UsuarioDTO } from "../dto/UsuarioDTO";
import { CreateUsuarioRequest } from "../dto/CreateUsuarioRequest";
import { ActualizarUsuarioRequest } from "../dto/ActualizarUsuarioRequest";

import { Usuario } from "../../dominio/entities/Usuario";
import type { ICrearUsuarioUseCase } from "../ports/input/usuario/ICrearUsuarioUseCase";
import type { IActualizarUsuarioUseCase } from "../ports/input/usuario/IActualizarUsuarioUseCase";
import type { IEliminarUsuarioUseCase } from "../ports/input/usuario/IEliminarUsuarioUseCase";
import type { IObtenerUsuarioUseCase } from "../ports/input/usuario/IObtenerUsuarioUseCase";
import type { IListarUsuariosUseCase } from "../ports/input/usuario/IListarUsuariosUseCase";

export class UsuarioService  {


  constructor(
         private CrearUsuariosUseCase: ICrearUsuarioUseCase,
        private ObtenerUsuariosUseCase: IObtenerUsuarioUseCase,
         private ListarUsuariosUseCase: IListarUsuariosUseCase,
        private ActualizarUsuariosUseCase: IActualizarUsuarioUseCase,
          private EliminarUsuariosUseCase: IEliminarUsuarioUseCase,
   
  ) {}

 

  async listarUsuarios(): Promise<UsuarioDTO[]> {

    const usuarios =
      await this.ListarUsuariosUseCase.execute();

    return usuarios.map(
      usuario =>
        new UsuarioDTO(
          usuario.id!,
          usuario.nombre,
          usuario.email
        )
    );
  }
  async obtenerUsuario(id: number): Promise<UsuarioDTO | null> {

    const usuario =
      await this.ObtenerUsuariosUseCase.execute(id);

    if (!usuario) {
      return null;
    }

    return new UsuarioDTO(
      usuario.id!,
      usuario.nombre,
      usuario.email
    );
  }

  async crearUsuario(
    request: CreateUsuarioRequest
  ): Promise<UsuarioDTO> {

    const usuario =
      await this.CrearUsuariosUseCase.execute(request);

    return new UsuarioDTO(
      usuario.id!,
      usuario.nombre,
      usuario.email
    );
  }

  async actualizarUsuario(
    id: number,
    request: ActualizarUsuarioRequest
  ): Promise<UsuarioDTO> {

    const usuario =
      await this.ActualizarUsuariosUseCase.execute(
        id,
        request
      );

    return new UsuarioDTO(
      usuario.id!,
      usuario.nombre,
      usuario.email
    );
  }

  async eliminarUsuario(id: number): Promise<void> {
    await this.EliminarUsuariosUseCase.execute(id);
    

     }
}