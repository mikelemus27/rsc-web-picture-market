// ======================================================
// ADAPTER OUT - REPOSITORY
// ======================================================


import { Pool } from "pg";

import type { IUsuarioRepositoryPort } from "../../../../aplicacion/ports/output/IUsuarioRepositoryPort";

import { Usuario } from "../../../../dominio/entities/Usuario";

export class UsuarioRepositoryImpl
  implements IUsuarioRepositoryPort {

  constructor(
    private db: Pool
  ) {}

  private reconstruirUsuario(row: any): Usuario {

    return Usuario.reconstruir(
      row.id,
      row.nombre,
      row.email
    );
  }
  async save(usuario: Usuario): Promise<Usuario> {

    if (usuario.id === null) {

      const result = await this.db.query(
        `
        INSERT INTO usuario(nombre, email)
        VALUES($1, $2)
        RETURNING *
        `,
        [usuario.nombre, usuario.email]
      );

      const row = result.rows[0];

      return this.reconstruirUsuario(row);
    }

    const result = await this.db.query(
      `
      UPDATE usuario
      SET nombre = $1,
          email = $2
      WHERE id = $3
      RETURNING *
      `,
      [
        usuario.nombre,
        usuario.email,
        usuario.id
      ]
    );

    const row = result.rows[0];

    return this.reconstruirUsuario(row);
  }

  async findById(
    id: number
  ): Promise<Usuario | null> {

    const result = await this.db.query(
      `
      SELECT *
      FROM usuario
      WHERE id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    return this.reconstruirUsuario(row);
  }

  async findAll(): Promise<Usuario[]> {

    const result = await this.db.query(
      `
      SELECT *
      FROM usuario
      `
    );

    return result.rows.map(
      row => this.reconstruirUsuario(row));
  }

  async deleteById(id: number): Promise<void> {

    await this.db.query(
      `
      DELETE FROM usuario
      WHERE id = $1
      `,
      [id]
    );
  }

  async existsByEmail(
    email: string
  ): Promise<boolean> {

    const result = await this.db.query(
      `
      SELECT EXISTS(
        SELECT 1
        FROM usuario
        WHERE email = $1
      )
      `,
      [email]
    );

    return result.rows[0].exists;
  }
}