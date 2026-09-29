

export class ActualizarUsuarioRequest {
  constructor(
    public id: number,
    public nombre: string,
    public email: string
  ) {}
}