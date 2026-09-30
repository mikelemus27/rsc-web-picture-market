# Tutorial detallado: Backend + Frontend con Docker Compose  
_Errores reales, causas y soluciones reutilizables_

Este tutorial documenta los problemas que fuiste encontrando al levantar y probar tu proyecto
`rsc-web-picture-market` con Docker/Docker Compose, tanto en backend como en frontend.

La idea es que este documento te sirva como referencia rápida cuando vuel para conectar frontend y backend
- Uso de variables entorno (`API_URL en tests
# Tutorial completo: Backend + Frontend con Docker Compose  
_Casos reales, errores, causas y soluciones_

Este documento resume, en detalle, los problemas que resolvimos en tu proyecto
**rsc-web-picture-market** (backend y frontend) usando **Docker** y
**Docker Compose**. Incluye:

- Explicación de la arquitectura (PostgreSQL + Backend Bun + Frontend Bun).
- Errores reales que aparecieron.
- Causas técnicas de cada error.
- Soluciones y configuraciones finales (incluyendo `docker-compose.yml` y `Dockerfile`).
- Comandos útiles de Docker y Docker Compose.

La idea es que puedas reutilizar estos patrones cada vez que tengas problemas
similares.

---

## 1. Arquitectura general:16-alpine`).
- **Backend**:
  - Servidor HTTP con Bun (`4001, ... })`).
  - Se conecta a PostgreSQL usando `pg.Pool`.
  - Expone una API REST de usuarios en `/usuarios` y `/usuarios/:id`.
- **Frontend (tests de contrato)**:
  - Un proyecto Bun que hace peticiones HTTP a la API del backend
    (por defecto a `http://localhost:4001`,_URL).

### 1.2. Redes Docker

 Los contores (PostSQL, backend y frontend) se comunican mediante una
  **red Docker bridge** llamada:

  ```text
  01_rsc (nombre real de la red existente en tu máquina).

- El backend y el frontend **no se hablan por `localhost`**, sino por el
  **nombre del servicio Docker en la red** (por ejemplo, `backend:4001`).

---

## 2. Backend: configuración y errores resueltos

### 2.1. `docker-compose.yml` del backend

Archivo: `_01_rsc_wpm_backend/docker-compose.yml` (simplificado):

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: always
    environment:
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: admin123
      POSTGRES_DBsc-network

  backend:
    build: .
    container_name: 01_rsc_wpm_bun_psgres-backend
    restart: unless-stopped
    ports:
      - "4001:4001"
    environment:
      DB_HOST: postgres
      DB_USER: admin
      DB_PASSWORD: admin123
      DB_NAME: wpm_db
      DB_PORT: 5432
    depends_on:
      - postgres
    networks:
      - rsc-network

volumes    driver: bridge
Puntos clave
El servicio postgres:

Expone el puerto 5432 al host ("5432:5432").
Define usuario/contraseña/DB por variables de entorno.
Está en la red rsc-network.
El servicio backend:

Se construye desde el Dockerfile del backend (build: .).
Expone el puerto 4001 al host.
Ap de datos usando:
yaml

DB_HOST: postgres
Es decir, usa el nombre del servicio Dockerpostgres(nolocalhost`).
Ambos servicios comparten networks: [rsc-network], lo que permite que el backend resuelva postgres como host.

2.2. Conexión a la base de datos en el backend
Archivo: _01_rsc_wpm_backend/src/infraestructura/database/postgres.ts:

ts

// ======================================================
// DATABASE CONNECTION
// ======================================================

import { Pool } from "pg";

export const db = new Pool({
  host: process.env.DB_HOST || "postgres",
  port: Number(process.env || 5432,
  user: process.env.DB_USER || "admin",
  password:",
  database: process.env.DB_NAME || "wpm_db",
});
Detalles importantes
Se usa DB_HOST desde variables de entorno, con fallback "postgres". el docker-compose.yml:
yaml

environment:
  DB_HOST: postgres
``ibles típ cómoarlos. de `ECONNREFUSED` o `ENOTFOUND postgres`**  
 Causas típicas:
 - El contenedor de `postgres `DB_HOST` apunta alocalhost` en vez de apostgres`.

 Solución:
 - Asegurarse de que ambos servicios comparten `networks: [rsc-network]`.
 - Usar el nombre del servicio Docker (`postgres`) como host.
 - Levantar los servicios con:
   ```bash
   docker compose up -d
Credenciales erróneas (password authentication failed for user ...)
Verificar que POSTGRES_USER, POSTGRES_PASSWORD y DB_* en backend coinciden.
2.3. Servidor HTTP en Bun (backend)
Archivo: _01_rsc_wpm_backend/src/index.ts (fragmento relevante):

ts

const server = Bun.serve({
  port: 4001,

  async fetch(req) {
    try {
      const url = new URL(req.url);
      const req.method;

      console.log(`\n${method etc.
      // ...
    } catch (error) {
      // puerto expone al host:

  ```yaml
  ports:
    - "4001:4001"
Esto permite hacer peticiones desde el host a http://localhost:4001/usuarios.

3. Frontend: contenedor y pruebas de contrato
3.1. Dockerfile del frontend
Archivo: _02_rsc_wp_frontend/Dockerfile:

dockerfile

# Containerize the CLI frontend as a Bun-based microservice
FROM oven/bun:1.3-alpineWORKDIR /app

COPY package.json bun.lock ./
COPY src/ ./src

RUN bun install --production

EXPOSE 4001
#CMD ["bun", "test", "./tests/usuarios.frontend.api.test.ts"]
Observaciones
Usa la imagenoven/bun:pine`.
Copia package.json y bun.lock para instalar dependencias.
Copia src/ (el código delenedordocker-compose.yml` del frontend (versión final)
Archivo: _02_rsc_wp_frontend/docker-compose.yml:

yaml

services:
  frontend:
    build: .
    container_name: 02_rsc_wp_bun_vue_frontend
    restart: unless-stopped
    env_file: .env
    volumes:
      - .:/app
    networks:
      - rsc-network

networks:
  rsc-network:
    external: true  # Usa una red ya existente    name: 01_rsc_wpm_backend_rsc cada cosa

- `build: .`: construye la imagen del frontend con el `Dockerfile` actual.
- `container_name`: nombre legible del contenedor.
- `env_file: .env`: carga variables de entorno desde el archivo `.env`.
- `volumes: - .:/app`:
  - Monta el código local dentro del contenedor (útil para desarrollo/tests).
- `networks: - rsc-network`: conecta este servicio a una red de Compose llamada `rsc-network`.
- En la sección `networks`:
  - `external: true`: indica que la red **ya existe y no la crea**.
  - `name: 01_rsc_wpm_backend_rsc-network`: nombre real de la red Docker
    (la misma que usa el backend).

Esto soluciona el warning:

> a network with name 01_rsc_wpm_backend_rsc-network exists but was not created for project "02_rsc_wp  
> Setexternal true an---

 . Error: ` service#### Com que fallababashdocker run --network_rsc_w_backend_rsc-network - bun test
Mensaje de error
text

no such service: --network
Causa
forma:

bash

docker compose run [OPTIONS] SERVICE [COMMAND] [ARGS...]
` y `--network` como si fuera `docker run` (modo clásico),
pero en **Docker Compose v2**:
- No se usa `--` para separar opciones de Docker y del comando interno.
La opción `--network` **no existe en `docker compose run`.
Compose interpreta `--network` como si fuera **el nombre de un servicio**,
de ahí el error `no such service: --network`.

#### Solución correcta

Usar simplemente:

```bash
docker compose bun test
frontend es el nombre del servicio definido en docker-compose.yml.
bun test es el comando a ejecutar dentro del contenedor.
--rm hace que el contenedor seAl ejecutar:
bash

docker compose run --rm frontend bun test
Aparecía algo como:

text

error: Unable to connect. Is the computer able to access the url?
  path: "http://localhost:4001/usuarios",
  errno: 0,
  = process.env.API_URL || "http://localhost:4001";

test("GET /usuarios returns 200 with array", async () => {
  const res = awaitenedor de `frontend`, `localhost:4001` **no**
  sino al mismo contenedor del frontend.
- Es decir, cuando los tests hacen `http://localhost:4001/...`:
  - Intentan conectar al puerto 4001 del contenedor del frontend.
  - Pero el backend está en **otro contenedor diferente**, conectado por red, o el `BASE_URL` no apunta al servicio correcto,
  se obtiene `ConnectionRefused`.

#### Sol que aplicamos

1. **Asegurar que el backend está levantado** (en su propio proyecto):

   ```bash
   cd _01_rsc_wpm_backend
  .Con el y a misma  imos elexternal true` y apuntando a
     `01_rsc_wpm_backend_rsc-network`.

3. **Configurar `API_URL` en el frontend para que ap por:

   ```env
   API_URL=http://backend:4001
(Dónde backend es el nombre del servicio en el docker-compose.yml del backend).

Como el test usa:

``` ||, y entonces las peticiones van a http://backend:4001/usuarios`.

Resultado
Después de configurar red y API_URL, al ejecutar:

bash

docker compose run --rm frontend bun test14 (0d9b296a)

tests/usuarios.frontend.api Front endpoint contracts GET /usuarios returns 200 with array
✓ Frontend users endpoint contracts > POST /usuarios creates user (201 or error handled)
✓ Frontend users endpoint contracts > GET /ruta endpoint contracts > GET /usuarios/abc returns 400 (invalid id)

 4 pass
 0 fail
 5 expect() calls
Ran 4 tests across 1 file.
4. Comandos de Docker/Docker Compose utilizados
4.1. Levantar servicios
En backend:

bash

cd _01_rsc_wpm_backend
docker compose up -d
up: levanta los servicios definidos en docker-compose.yml.
-d: modo detached (enbash02_rsc_wp_frontend docker compose up -d
text


### 4.2. Ejecutar pruebas en el frontend

```bash
cd _02_rsc_wp_frontend
docker compose run --rm frontend bun test
Ejecuta bun test dentro de un contenedor temporal del servicio frontend.
Después borra el contenedor (--rm).
:

bash cd _01_rsc_wpm_backend docker compose logs -f backend

text


Postgres:

```bash
docker compose logs -f postgres
Frontend (si se levanta con up y contenedores

Listar redes:

bash

docker network ls
Inspectar una red en concreto (por ejemplo, la del backend):

bash

docker network inspect 01_rsc_wpm_backend_rsc-network
Listar contenedores:

bash

docker ps
Plantillas reutilizables

5.1. Patrón para backend con DB en la misma red
text

    environment:
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: admin123
      POSTGRES_DB: my_db
    networks:
      -:
    build: .
    environment:
      DB_HOST: db
      DB_USER: admin
      DB_PASSWORD: admin123 DB_NAME: my_db
      DB_PORT: 5432
    depends_on:
      - db
    networks:
      - app-network

networks:
  app-network:
    driver: bridge
5.2. Patrón para frontend/test que consume el backend en otra carpeta
yaml

services:
  frontend:
    build: .
    env_file: .env
    networks:
      - shared-network

networks:
  shared-network
.env:

env

API_URL=http://backend:400 BASE_URL = process.env.API_URL || "http://localhost:4001";
6. Resumen final de lecciones aprendidas
docker compose run ≠ docker run:

No uses -- ni --network como en `docker]
text

localhost dentro de un el host ni otro contenedor:

Para hablar con otro contenedor, hay que usar el **nombre: http://backend:4001, host: 'postgres'.
**Red creada una red (docker network ls), y quieres que otro proyecto/Compose la use, debes declarar:

yaml

networks:
 
Variables de entorno bien pensadas:

Backend:
DB_HOST, DB_PORT, DB_USER - - API_URL` para apuntar a la API (backend) adecuada según el entorno.
Montar el código con volúmenes (.:/app) es útil en desarrollo:

Permite editar el código en tu máquina y ejecutar testsCon este flujo documentado, la próxima vez que tengas problemas similares de redes, puertos o comunicación entre servicios Docker, podrás:
Revisar si el error es por sintaxis de docker compose run.
Ver en la misma red.
Comprobar si localhost se está usando incorrectamente dentro contenedores.
Ajustar variables de entorno como API_URL y DB_HOST.
## 1. Conceptos básicos que se usaron

Antes de entrar a los errores concretos, repasemos brevemente:

### 1.1. Comandos clave de Docker Compose

- Levantar servicios en segundo plano:

  ```bash
  docker compose upd
 `

- Ver logs de servicio:

  ```bash
 docker compose logs -f NOMBRE_SERVICIO
Detener contenedores del proyecto actual:

bash

docker compose down
Ejecutar un comando puntual en un servicio (sin dejarlo corriendo):

bash

docker compose run --rm NOMBRE_SERVICIO COMANDO [ARGS...]
Ejemplo real que usaste:

bash

docker compose run --rm frontend bun test
.2. Estructura básica de docker-compose.yml
Muy simplificada:

yaml

services:
  NOMBRE_SERVICIO:
    image: IMAGEN_O_BUILD
    build: .
    ports:
      - "HOST:CONTAINER"
    env_file: .env
    environment:
: valor
    networks:
      - red-app

networks:
  red driver: bridge
2. Problema Uso incorrecto de docker compose run con --network
2.1. Lo que ejecutaste
docker compose run -- --network 01_rsc_wpm_backend_rsc-network - bun`

Y el error:

text

no such service: --network
2.2. Causa
**Sintaxis incorrecta de ```bash docker compose run [OPCIONES patrónrun -- --network ... - ...como endocker run` “puro”.

docker compose interpreta --networknombre de un servicio**. Como no existe un servicio llamado --network`, aparece:

```text pasaadocker compose run`. En vez de eso:

Se define la en el propio docker-compose.yml.

Y luego se usa un comando simple:

bash

docker compose run --rm frontend bun línea de comandos.)_
3. Problema 2: Intentar ejecutar el contenedor como comando
Probaste algo así:

bash

02_rsc_wp_frontend-frontend bun test
Y obtuviste:

sc_wp_frontend-frontend: command not found

text


.1. Causa

- `02_rsc_wp_frontend-frontend` es un **nombre no bin.
 Linux intenta unable `_r_wpend- en tu` y, como no existe, da `command not found`.

3.2. Solución

Para **ejecutar un comando dentro de un contenedor gestionado por Compose**, se usa:

```bash
docker compose run --rm NOMBRE_SERVICIO COMANDO
 tu caso:

```bash
docker compose run --rm frontend bun test
4. Configuración inicial de docker-compose.yml del frontend
Tu fichero (simplificado) estaba así:

yaml

services:
  frontend:
    build_r   -stopped
    env_file: .env
    # removed (uses running backend at 01_rsc_wpm...)
 networks      - rsc-network
    volumes:
      - .:/app

volumes:
  postgres_data:

networks:
  rsc-network:
    driver: bridge
.1. Problema potencial

Declarabas una red rsc-network, pero en el proyecto backend ya existía una red llamada
01_rsc_wpm_backend_rsc-network.
Cuando lanzaste el comando:

bash

docker
Docker te avisó:

text

WARN[0000] a network with name 01_rsc_wpm_r-network exists but was not 
created for "02_rsc_wp_frontend".
Set `external: true` to use an existing network
4.2. Causa
Estás en un proyecto diferente (02_rsc_wp_frontend), pero quieres usar la red creada por el backend.
Docker ve la red ya existente pero detecta que no fue creada por este proyecto de Compose, y por eso sugiere external:Para que el frontend se conecte a la red donde está el backend, cambiaste tu docker-compose.yml` a algo como:
yaml

services:
  frontend:
    build: .
    container_name: 02_rsc_wp_bun_vue_frontend
    restart: unless-stopped
    env_file: .env
    volumes:
      - .:/app
    networks:
      - rsc-network

: 01_rsc_wpm_backend_rsc-network
5.1. Qué significa esto
external: true → indica que la red ya existe, y Compose no debe crearla.
name:-network → es el nombre real de la red que ya creó el proyecto backend.
Con esto:

El servicio frontend queda enganchado a la misma red donde.
Los pueden resolver por nombre de servicio (ej: backend) dentro de esa redRefused`
Cuando los tests de frontend corrieron correctamente en apareció:

text

error: Unable to connect. Is?
  path: "http://localhost:4001/usuarios",
  errno: 0,
  code: "ConnectionRefused"
Y varios tests fallaban.

6.1. Código relevante en el test
ts

const BASE_URL = process.env.API_URL://:4001";
6.2. Causa
Significado de localhost dentro de un contenedor

http://localhost:4001 dentro del contenedor frontend apunta al propio contenedor frontend, no a tu máquina host.
Si el backend corre en otro contenedor, localhost no sirve para alcanzarlo.
**Backend no exp - El backend está probablemente en un, ejemplobackend`, de esa misma red.

Desde el contenedor frontend, deberías usar algo como:
http://backend:4001
(donde backend es el service.name en el docker-compose.yml del backend).
API_URL no configurada

Como no se definió API_URL, el test usaba el valor por defecto "http://localhost:4001" y fallaba con ConnectionRefused.
6.3. Solución: configurar API_URL y usar la red compartidaponiendo que tu backend tuviera algo como esto en su docker-compose.yml:
yaml

services:
  backend: .
    container_name: 01_rsc_wpm_backend
    restart: unless-stopped
    ports:
      - "4001:4001"
    networks:
      - rscworks:
  rsc-network:
    name: 01_rsc_wpm_backend_rsc-network
Entonces, en tu frontend, ajustaste el docker-compose.yml así:

yaml

services:
  frontend:
    build: .
    container_name: 02_rsc_wp_bun_vue_frontend
    restart: unless-stopped
    env_file: .env
    environment:
      API_URL: http://backend:4001
    volumes:
      - .:/app
    networks:
      - rsc-network

networks:
  rsc-network:
    external: true
    name: 01_rsc_wpm_backend_rsc-network
Puntos clave:

API_URL: http://backend:4001
backend → nombre del servicio backend en su docker-compose.yml.
4001 → puerto interno expuesto por el backend.
Como ambos servicios están en la misma red (`01_rsc_w. Resultado
Tras configurar la red externa y API_URL, al `

Obtutexttests/usuarios.frontend.api.test.ts: ✓ Frontend users endpoint contracts > GET /usuarios returns 200 with array ✓ Frontend users endpoint contracts > POST /usuarios creates user (201 or error handled) ✓ Frontend users endpoint contracts > GET /ruta-inexistente returns 404 ✓ Frontend users endpoint contracts > GET /usuarios/abc . Limpieza del warning de red

Incluso cuando todo pasó, Docker te seguía mostrando:

text

WARN[0000] a network with name 01_rsc_wpm_backend_rsc-network exists but was 
not created for project "02_rsc_wp_frontend".
Set `external: true`1. Causa

- La red existía, pero el `docker-compose.yml` del frontend todavía no tenía `external: true`.

### 7.2. Solución final de `docker-compose.yml` del frontend

La versión correcta queda:

```yaml
services:
  frontend:
    build: .
    container_name: 02_rsc_wp_bun_vue_frontend
    restart: unless-stopped
 .env
    environment:
      API_URL: http://backend:4001
    volumes:
      - .:/app
    networks:
 rnetworks:
  rsc-network:
    external: true
    name: 01_rsc_wpm_backend_rsc-network
Con esto, el warning desaparece.

8. Resumen de comandos Docker usados y su propósito
Comando	Para qué se usó
docker compose up -d	Levantar el backend (y/o frontend) en segundo plano
docker compose run --rm frontend bun test	Ejecutar los tests de frontend en un contenedor efímero
docker compose logs -f backend	Ver logs del backend en tiempo real (útil si hay errores 500)
docker compose down	Bajar todos los servicios del proyecto actual
docker network ls	(opcional) Ver las redes existentes
docker network inspect 01_rsc_wpm_backend_rsc-networkcional) Ver detalles de la red compartida	
9. Checklist para futuros proyectos
Cuando tengas una arquitectura similar (backend + frontend + tests), revisa:

**¿El backend -d` desde el proyecto backend.

Verifica que expone el puerto correcto (ej: 4001).
¿Frontend y backend están en la misma red Docker?

En backend: define una red (networks:).
En frontend_DEL_BACKEND`.
¿Estás usando el nombre del servicio backend y no localhost?

Desde otro contenedor, usa http://NOMBRE_SERVICIO:PUERTO_INTER - máquina host es correcto usar http://localhost:PUERTO_PUBLICADO` [blocked].
¿Las variables de entorno están bien configuradas?

Usa env_file: .env para cargar comunes.
Usa environment: en docker-compose.yml para sobreescribir lo que necesites (como API_URL).
¿Estás usando docker compose run con la sintaxis correcta?




