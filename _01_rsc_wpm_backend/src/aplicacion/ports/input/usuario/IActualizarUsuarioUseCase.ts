// ======================================================
// INPUT PORT
// ACTUALIZAR USUARIO
// ======================================================

import { UsuarioDTO }
from "../../../dto/UsuarioDTO";

import { ActualizarUsuarioRequest }
from "../../../dto/ActualizarUsuarioRequest";

export interface IActualizarUsuarioUseCase {

  execute(
    id: number,
    request: ActualizarUsuarioRequest
  ): Promise<UsuarioDTO>;
}