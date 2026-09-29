// ======================================================
// ELIMINAR USUARIO USE CASE
// ======================================================

import type { IEliminarUsuarioUseCase } from "../../../ports/input/usuario/IEliminarUsuarioUseCase";
import type{ IUsuarioRepositoryPort } from "../../../ports/output/IUsuarioRepositoryPort";

export class EliminarUsuarioUseCase implements IEliminarUsuarioUseCase {

  constructor(
    private usuarioRepository: IUsuarioRepositoryPort
  ) {}

  async execute(id: number): Promise<void> {

    /*
    ==========================================
    VERIFICAR EXISTENCIA
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
    ELIMINAR
    ==========================================
    */

    await this.usuarioRepository
      .deleteById(id);
  }
}