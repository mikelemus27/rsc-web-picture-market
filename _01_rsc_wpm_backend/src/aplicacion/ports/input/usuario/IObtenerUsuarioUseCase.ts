// ======================================================
// INPUT PORT
// OBTENER USUARIO
// ======================================================

import { UsuarioDTO }
from "../../../dto/UsuarioDTO";

export interface IObtenerUsuarioUseCase {

  execute(
    id: number
  ): Promise<UsuarioDTO | null>;
}