// ======================================================
// ACTUALIZAR USUARIO USE CASE
// ======================================================

import type { IUsuarioRepositoryPort } from "../../../ports/output/IUsuarioRepositoryPort";

import { UsuarioDTO } from "../../../dto/UsuarioDTO";

import { ActualizarUsuarioRequest } from "../../../dto/ActualizarUsuarioRequest";
import type { IActualizarUsuarioUseCase } from "../../../ports/input/usuario/IActualizarUsuarioUseCase";

export class ActualizarUsuarioUseCase  implements IActualizarUsuarioUseCase {

  constructor(
    private usuarioRepository: IUsuarioRepositoryPort
  ) {}

  async execute(
    id: number,
    request: ActualizarUsuarioRequest
  ): Promise<UsuarioDTO> {

    /*
    ==========================================
    BUSCAR USUARIO
    ==========================================
    */

    const usuario =
      await this.usuarioRepository
        .findById(id);

    if (!usuario) {
      throw new Error(
        "Usuario no encontrado"
      );
    }

    /*
    ==========================================
    ACTUALIZAR ENTIDAD
    ==========================================
    */

    usuario.actualizar(
      request.nombre,
      request.email
    );

    /*
    ==========================================
    GUARDAR CAMBIOS
    ==========================================
    */

    const updated =
      await this.usuarioRepository
        .save(usuario);

    /*
    ==========================================
    RESPUESTA
    ==========================================
    */

    return new UsuarioDTO(
      updated.id!,
      updated.nombre,
      updated.email
    );
  }
}