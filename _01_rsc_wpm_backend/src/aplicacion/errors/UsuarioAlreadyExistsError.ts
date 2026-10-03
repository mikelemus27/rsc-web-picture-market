export class UsuarioAlreadyExistsError extends Error {
  constructor(message = "El email ya existe") {
    super(message);
    this.name = "UsuarioAlreadyExistsError";
  }
}
