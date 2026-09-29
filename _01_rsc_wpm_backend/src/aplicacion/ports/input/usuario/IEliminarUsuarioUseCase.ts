// ======================================================
// INPUT PORT
// ELIMINAR USUARIO
// ======================================================

export interface IEliminarUsuarioUseCase {

  execute(
    id: number
  ): Promise<void>;
}