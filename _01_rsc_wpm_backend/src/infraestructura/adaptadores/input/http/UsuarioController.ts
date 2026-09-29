// ======================================================
// ADAPTER IN - CONTROLLER
// ======================================================

import { UsuarioService } from "../../../../aplicacion/services/UsuarioService";
import { UsuarioDTO } from "../../../../aplicacion/dto/UsuarioDTO";
import { CreateUsuarioRequest } from "../../../../aplicacion/dto/CreateUsuarioRequest";
import type { ActualizarUsuarioRequest } from "../../../../aplicacion/dto/ActualizarUsuarioRequest";

export class UsuarioController {
  constructor(private usuarioService: UsuarioService) {}

  crearUsuario = async (dtoUser: CreateUsuarioRequest): Promise<UsuarioDTO> => {
    return await this.usuarioService.crearUsuario(dtoUser);
  };

  obtenerUsuario = async (id: number): Promise<UsuarioDTO | null> => {
    return await this.usuarioService.obtenerUsuario(id);
  };

  listarUsuarios = async (): Promise<UsuarioDTO[]> => {
    return await this.usuarioService.listarUsuarios();
  };

  actualizarUsuario = async (
    dtoActualizarUsuario: ActualizarUsuarioRequest
  ): Promise<UsuarioDTO> => {
    return await this.usuarioService.actualizarUsuario(
      dtoActualizarUsuario.id,
      dtoActualizarUsuario
    );
  };

  eliminarUsuario = async (id: number): Promise<void> => {
    await this.usuarioService.eliminarUsuario(id);
  };
}
