// ======================================================
// OBTENER USUARIO USE CASE
// ======================================================

import type{  IUsuarioRepositoryPort } from "../../../ports/output/IUsuarioRepositoryPort";

import { UsuarioDTO } from "../../../dto/UsuarioDTO";
import type { IObtenerUsuarioUseCase } from "../../../ports/input/usuario/IObtenerUsuarioUseCase";

export class ObtenerUsuarioUseCase implements IObtenerUsuarioUseCase {

  constructor(
    private usuarioRepository: IUsuarioRepositoryPort
  ) {}

  async execute(
    id: number
  ): Promise<UsuarioDTO | null> {

    const usuario =
      await this.usuarioRepository
        .findById(id);

    if (!usuario) {
      return null;
    }

    return new UsuarioDTO(
      usuario.id!,
      usuario.nombre,
      usuario.email
    );
  }
}