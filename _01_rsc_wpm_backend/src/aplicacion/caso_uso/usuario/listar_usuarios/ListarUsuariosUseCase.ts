// ======================================================
// LISTAR USUARIOS USE CASE
// ======================================================

// ======================================================
// LISTAR USUARIOS USE CASE
// ======================================================
import type { IUsuarioRepositoryPort } from "../../../ports/output/IUsuarioRepositoryPort";

import { UsuarioDTO } from "../../../dto/UsuarioDTO";
import type { IListarUsuariosUseCase } from "../../../ports/input/usuario/IListarUsuariosUseCase";

export class ListarUsuariosUseCase  implements IListarUsuariosUseCase {

  constructor(
    private usuarioRepository: IUsuarioRepositoryPort
  ) {}

  async execute(): Promise<UsuarioDTO[]> {

    const usuarios =
      await this.usuarioRepository
        .findAll();

    return usuarios.map(
      usuario =>
        new UsuarioDTO(
          usuario.id!,
          usuario.nombre,
          usuario.email
        )
    );
  }
}