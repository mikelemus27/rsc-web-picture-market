import { HttpClient }
from "../../core/http/HttpClient";

import type { TUsuarioRequest } from "../dto/TUsuarioRequest";

export class UsuarioApiService {

  constructor(

    private readonly http:
      HttpClient,

    private readonly baseUrl:
      string

  ) {}

  async getUsuarios() {

    return this.http.get(
      `${this.baseUrl}/usuarios`
    );

  }

  async getUsuarioById(id: number) {

    return this.http.get(
      `${this.baseUrl}/usuarios/${id}`
    );

  }

  async createUsuario(
    body: TUsuarioRequest
  ) {

    return this.http.post(
      `${this.baseUrl}/usuarios`,
      body
    );

  }

  async updateUsuario(
    id: number,
    body: TUsuarioRequest
  ) {

    return this.http.put(
      `${this.baseUrl}/usuarios/${id}`,
      body
    );

  }

  async deleteUsuario(id: number) {

    return this.http.delete(
      `${this.baseUrl}/usuarios/${id}`
    );

  }

}