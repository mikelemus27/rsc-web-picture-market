// ======================================================
// DTOs
// ======================================================

// application/dto/UsuarioDTO.ts

export class UsuarioDTO {
  constructor(
    public id: number,
    public nombre: string,
    public email: string
  ) {}
}