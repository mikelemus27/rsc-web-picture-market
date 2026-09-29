export class HttpClient {
    async get(url: string): Promise<Response> {

    return fetch(url);
  }

  async post(
    url: string,
    body: unknown
  ): Promise<Response> {

    return fetch(url, {

      method: "POST",

      headers: {
        "Content-Type":
          "application/json"
      },

      body: JSON.stringify(body)

    });

  }

  async put(
    url: string,
    body: unknown
  ): Promise<Response> {

    return fetch(url, {

      method: "PUT",

      headers: {
        "Content-Type":
          "application/json"
      },

      body: JSON.stringify(body)

    });

  }

  async delete(
    url: string
  ): Promise<Response> {

    return fetch(url, {
      method: "DELETE"
    });

  }

}