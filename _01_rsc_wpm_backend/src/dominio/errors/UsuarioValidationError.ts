export class UsuarioValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UsuarioValidationError";
  }
}
