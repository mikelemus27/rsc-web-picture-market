// ======================================================
// DOMAIN
// ======================================================

// ======================================================
// DOMAIN - ENTIDAD RICA BLINDADA
// ======================================================

import { UsuarioValidationError } from "../errors/UsuarioValidationError";

export class Usuario {
  
  // 1. CONSTRUCTOR PRIVADO: Nadie desde fuera puede hacer `new Usuario(...)`
  private constructor(
    public readonly id: number | null, 
    private _nombre: string,           
    private _email: string             
  ) {}

  // Getters públicos de solo lectura
  get nombre(): string { return this._nombre; }
  get email(): string { return this._email; }

  // 2. MÉTODO DE FÁBRICA: Para crear usuarios NUEVOS (Sin ID aún)
  static crear(nombre: string, email: string): Usuario {
    // Validaciones estrictas en el nacimiento
    if (!email || !email.includes("@")) {
      throw new UsuarioValidationError("El formato del email es inválido para el nuevo usuario");
    }
    if (!nombre || nombre.trim().length < 2) {
      throw new UsuarioValidationError("El nombre debe tener al menos 2 caracteres");
    }

    // Si todo está bien, la propia clase sí puede invocar a su constructor privado
    return new Usuario(null, nombre.trim(), email.trim());
  }

  // 3. MÉTODO DE FÁBRICA: Para RECONSTRUIR usuarios que ya existen en PostgreSQL
  static reconstruir(id: number, nombre: string, email: string): Usuario {
    // Aquí no validamos las reglas de creación porque el dato ya es confiable (viene de la DB)
    return new Usuario(id, nombre, email);
  }

  // 4. COMPORTAMIENTO: El único punto para modificar el estado
  actualizar(nombre: string, email: string): void {
    if (!email || !email.includes("@")) {
      throw new UsuarioValidationError("Email inválido para actualización");
    }
    this._nombre = nombre.trim();
    this._email = email.trim();
  }
}