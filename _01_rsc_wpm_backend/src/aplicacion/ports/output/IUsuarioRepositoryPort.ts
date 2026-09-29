// ======================================================
// OUTPUT PORT
// ======================================================



import { Usuario } from "../../../dominio/entities/Usuario";

export interface IUsuarioRepositoryPort {
  save(usuario: Usuario): Promise<Usuario>;

  findById(id: number): Promise<Usuario | null>;

  findAll(): Promise<Usuario[]>;

  deleteById(id: number): Promise<void>;

  existsByEmail(email: string): Promise<boolean>;
}