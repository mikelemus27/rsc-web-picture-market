export class UsuarioNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UsuarioNotFoundError";
  }
}