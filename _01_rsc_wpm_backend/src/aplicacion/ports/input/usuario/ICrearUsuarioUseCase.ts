// ======================================================
// INPUT PORT
// CREAR USUARIO
// ======================================================

import { CreateUsuarioRequest }
from "../../../dto/CreateUsuarioRequest";

import { UsuarioDTO }
from "../../../dto/UsuarioDTO";

export interface ICrearUsuarioUseCase {

  execute(
    request: CreateUsuarioRequest
  ): Promise<UsuarioDTO>;
}