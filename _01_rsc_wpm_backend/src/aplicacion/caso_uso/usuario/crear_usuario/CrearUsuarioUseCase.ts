
// ======================================================
// CREAR USUARIO USE CASE
// ======================================================

// ======================================================
// CREAR USUARIO USE CASE
// ======================================================
import type { IUsuarioRepositoryPort } from "../../../ports/output/IUsuarioRepositoryPort";

import { Usuario } from "../../../../dominio/entities/Usuario";

import { UsuarioDTO } from "../../../dto/UsuarioDTO";

import { CreateUsuarioRequest } from "../../../dto/CreateUsuarioRequest";
import type { ICrearUsuarioUseCase } from "../../../ports/input/usuario/ICrearUsuarioUseCase";
import { UsuarioAlreadyExistsError } from "../../../errors/UsuarioAlreadyExistsError";

export class CrearUsuarioUseCase implements ICrearUsuarioUseCase {

  constructor(
    private usuarioRepository: IUsuarioRepositoryPort
  ) {}

  async execute(
    request: CreateUsuarioRequest
  ): Promise<UsuarioDTO> {

    /*
    ==========================================
    VALIDAR EMAIL DUPLICADO
    ==========================================
    */

    const exists =
      await this.usuarioRepository
        .existsByEmail(request.email);

    if (exists) {
      throw new UsuarioAlreadyExistsError();
    }

    /*
    ==========================================
    CREAR ENTIDAD
    ==========================================
    */

    const usuario = Usuario.crear(
      request.nombre,
      request.email
    );

    /*
    ==========================================
    GUARDAR
    ==========================================
    */

    const saved =
      await this.usuarioRepository
        .save(usuario);

    /*
    ==========================================
    RESPUESTA
    ==========================================
    */

    return new UsuarioDTO(
      saved.id!,
      saved.nombre,
      saved.email
    );
  }
}