# Docker Compose: Backend and Frontend Learnings
_Errores reales, causas y soluciones reutilizables — proyecto rsc-web-picture-market_

Historical operational notes for connecting the Bun backend, PostgreSQL, and frontend API tests. Compose settings and test outcomes change; inspect the current files and rerun commands before treating a snapshot below as current.

---

## 1. Arquitectura general

- **PostgreSQL** (`postgres:16-alpine`): database `wpm_db`; use the current Compose configuration for credentials rather than copying them into notes.
- **Backend** (`_01_rsc_wpm_backend/`): Bun en `4001`, conecta a `postgres` por red Docker (`pg.Pool`, `DB_HOST: postgres`, no `localhost`).
- **Frontend (tests)** (`_02_rsc_wp_frontend/`): Bun que hace `fetch()` al backend indicado por `API_URL`. Si no se define, las pruebas locales usan `http://localhost:4001`; dentro del contenedor, `.env` debe apuntar al nombre de backend en la red compartida (`01_rsc_wpm_bun_psgres-backend:4001`).
- **Red Docker**: el backend crea una red bridge con nombre de proyecto Compose; el frontend se une a ella como red externa. Verifica el nombre actual en ambos Compose files.

Reglas clave:
- Dentro de contenedor: `localhost` = ese mismo contenedor (nunca el backend).
- Entre contenedores: usar `nombre_servicio:puerto` (ej: `backend:4001`).
- `.env` del contenedor frontend debe usar el nombre del backend, no `localhost`. Si `API_URL` está configurado pero no responde, las pruebas fallan; no cambian silenciosamente a localhost.

---

## 2. Incidentes históricos resueltos

### 2.1 Historical: ConnectionRefused / FailedToOpenSocket al correr tests
**Síntoma:** `error: Unable to connect. Is the computer able to access the url? path: "http://localhost:4001/usuarios"`
**Causa:** `.env` default (`localhost:4001`) usa el contenedor del frontend como destino, no el backend.
**Solución:** `.env` → `API_URL=http://01_rsc_wpm_bun_psgres-backend:4001`; y asegurar red compartida (`rsc-shared` / `external: true`).
**Verificado:** `docker compose run --rm frontend bun test` → 4 pass, 0 fail.

### 2.2 Historical: loop de reinicio del contenedor frontend (`Restarting (1)`)
**Síntoma:** `02_rsc_wp_bun_vue_frontend` reinicia cada ~17 segundos; `docker exec` dice "container is restarting".
**Causa:** `Dockerfile` tenía `CMD ["bun", "run", "src/index.ts"]` que fallaba al iniciar (conexión al backend fallida); Docker reiniciaba.
**Solución:** `Dockerfile` CMD → `CMD ["bun", "test", "./tests/usuarios.frontend.api.test.ts"]`; `.dockerignore` excluye `tests/` de imagen prod; `docker-compose.prod.yml` sin volumen; `docker-compose.yml` con `volumes: - .:/app` para dev.
**Resultado en esa revisión:** contenedor `Up` estable, sin `Restarting`.

### 2.3 Historical: red aislada entre backend y frontend
**Síntoma:** `.env` correcto (`01_rsc_wpm_bun_psgres-backend:4001`), backend `Up`, pero `ConnectionRefused` persiste.
**Causa:** `docker-compose.yml` del backend crea `rsc-network`; `docker-compose.yml` del frontend crea otra instancia con mismo nombre pero diferente ID de red (aislamiento por proyecto Compose). `docker inspect` muestra IDs distintos (`31557...` vs `33bb...`).
**Solución en ese momento:** se probaron redes externas y `rsc-shared`. La configuración actual validada ya no debe deducirse de esos comandos antiguos: el frontend Compose declara como externa la red con nombre `01_rsc_wpm_backend_rsc-network`, creada por el proyecto Compose backend. El comando actual `test-frontend` usa ese Compose file; consulta la sección 6.

### 2.4 Historical: backend API tests absent from production image
**Síntoma:** `bun test` encuentra archivo pero `docker build` no lo incluye; `docker exec -T backend bun test ...` falló por no encontrar archivo.
**Causa:** `Dockerfile` backend (multi-stage) solo copia `dist/`; `.dockerignore` excluye `tests/`.
**Solución en ese momento:** ejecutar en el host o montar la fuente para desarrollo, sin ampliar la imagen de producción.
**Flujo actual:** `test-backend --container` copia temporalmente `test/usuarios.backend.api.test.ts` al contenedor backend, ejecuta la suite allí y lo elimina al terminar. Los resultados `2 pass, 2 fail` son de una suite anterior y no representan la suite actual.

### 2.5 Historical: API tests fail because the PostgreSQL schema is missing
**Síntoma:** backend and frontend contract suites both failed: `GET /usuarios` returned HTTP 500 and the backend log reported PostgreSQL error `42P01`, `relation "usuario" does not exist`.
**Aislamiento:** `psql -U admin -d wpm_db -c '\dt'` showed no relations. The backend was reachable, so changing network settings would not fix this failure.
**Causa:** PostgreSQL had initialized the database but no application table had been created. A healthy database connection does not imply that the application schema exists.
**Solución:** add an idempotent `usuario` table script under `_01_rsc_wpm_backend/db/init/` and mount it into `/docker-entrypoint-initdb.d/` for new database volumes. Apply a schema change to an existing volume with a migration or explicit SQL; do not delete the volume to trigger initialization again.
**Verificado:** created the table in the current volume without removing it; backend and frontend suites each reported `4 pass, 0 fail`. The automatic init path on a newly created volume was not exercised.
**Más detalles:** [PostgreSQL learnings](./postgresql-learnings.md).

---

## 3. Configuration snapshots from earlier verification

### 3.1 `.env` (frontend)
```env
API_URL=http://01_rsc_wpm_bun_psgres-backend:4001
```
Nota: nunca `localhost` dentro del contenedor de frontend.

### 3.2 `_02_rsc_wp_frontend/.dockerignore`
```
tests/
.git
node_modules
```
Excluye `tests/` de la imagen de producción (`docker build .` → imagen lean, sin tests).

### 3.3 `_02_rsc_wp_frontend/Dockerfile`
```dockerfile
FROM oven/bun:1.3-alpine
WORKDIR /app
COPY package.json bun.lock ./
COPY src/ ./src
RUN bun install --production
EXPOSE 4001
CMD ["bun", "test", "./tests/usuarios.frontend.api.test.ts"]
```
Snapshot histórico: `CMD` cambió de `bun run src/index.ts` (loop de reinicio) a `bun test` (ejecuta y sale; sin `Restarting`). Comprueba el Dockerfile actual antes de reutilizar este ejemplo.

### 3.4 `_02_rsc_wp_frontend/docker-compose.prod.yml`
```yaml
services:
  frontend:
    build: .
    container_name: 02_rsc_wp_bun_vue_frontend
    env_file: .env
    networks:
      - rsc-network
# Sin volumes (producción lean), sin depends_on duplicado
```
Snapshot histórico: `volumes: - .:/app` solo en `docker-compose.yml` (dev); `.prod.yml` era imagen limpia.

### 3.5 `_02_rsc_wp_frontend/docker-compose.yml` (dev)
```yaml
services:
  frontend:
    build: .
    container_name: 02_rsc_wp_bun_vue_frontend
    env_file: .env
    volumes:
      - .:/app        # bind mount para tests con código vivo
    networks:
      - rsc-network
    # depends_on eliminada (usa backend corriendo externo, no inicia bun_app duplicado)
networks:
  rsc-network:
    driver: bridge
    # external / name: 01_rsc_wpm_backend_rsc-network (según red existente del backend)
```
Snapshot histórico: `depends_on: - bun_app` se eliminó para evitar un backend duplicado; verifica el Compose actual antes de reutilizar este ejemplo.

### 3.6 `_01_rsc_wpm_backend/docker-compose.yml` (limpio)
```yaml
services:
  postgres:
    image: postgres:16-alpine
    ...
  backend:
    build: .
    container_name: 01_rsc_wpm_bun_psgres-backend
    ports:
      - "4001:4001"
    depends_on:
      - postgres
    networks:
      - rsc-network
# servicio `frontend` eliminado (no pertenece a backend)
```
Snapshot histórico: los puertos publicados han cambiado entre revisiones. El backend usa el puerto interno de PostgreSQL `5432`; comprueba los puertos host actuales en Compose.

---

## 4. Comandos y resultados históricos

### 4.1 Levantar (solo los necesarios)
```bash
# Backend
cd _01_rsc_wpm_backend && docker compose up -d backend

# Frontend (dev, con bind mount + .env)
docker compose -f _02_rsc_wp_frontend/docker-compose.yml up -d --no-deps frontend
# o con red compartida explícita:
docker run -d --name 02_rsc_wp_bun_vue_frontend --network rsc-shared \
  -v $(pwd)/_02_rsc_wp_frontend:/app -w /app \
  --env-file _02_rsc_wp_frontend/.env 02_rsc_wp_frontend-frontend
```

### 4.2 Ejecutar tests de frontend dentro del container (snapshot antiguo: 4 pass)
```bash
docker compose run --rm frontend bun test ./tests/usuarios.frontend.api.test.ts
```
Resultado observado: `4 pass, 0 fail, 5 expect() calls, Ran 4 tests across 1 file. [82.00ms]`.
Nota: `docker compose run --rm` es la forma correcta (no `--network`; el servicio ya está en la red definida en `docker-compose.yml`).

#### Cómo interpretar la salida del comando

Comando ejecutado desde la raíz del repositorio:
```bash
docker compose -f _02_rsc_wp_frontend/docker-compose.yml run --rm frontend bun test ./tests/usuarios.frontend.api.test.ts
```

- `-f _02_rsc_wp_frontend/docker-compose.yml` le indica a Compose qué archivo define el servicio `frontend`.
- `run --rm frontend` crea un contenedor temporal para ese servicio y lo elimina al terminar. No elimina la imagen ni detiene el backend.
- `bun test ./tests/usuarios.frontend.api.test.ts` ejecuta ese archivo de pruebas dentro del contenedor usando Bun.
- `Remote API responded; using http://01_rsc_wpm_bun_psgres-backend:4001.` confirma que el chequeo inicial alcanzó el backend y seleccionó la URL configurada en `API_URL`. Como el test está dentro de Docker, usa el nombre del backend en la red compartida; `localhost` dentro del contenedor se referiría al propio contenedor frontend.
- Los cuatro casos comprobaron: `GET /usuarios` devuelve `200` y un arreglo; `POST /usuarios` devuelve un estado permitido; una ruta inexistente devuelve `404`; y un ID no numérico devuelve `400`.
- `4 pass, 0 fail` indica que las cuatro pruebas terminaron pasando. `5 expect() calls` cuenta las comprobaciones de aserción ejecutadas dentro de esas pruebas.

**Importante:** el test de `POST /usuarios` acepta `201`, `409` o `500`. Por eso su aprobación solo confirma que el estado recibido está en esa lista; no confirma necesariamente que el usuario se haya creado correctamente. Si se requiere garantizar la creación, el test debe esperar `201` y comprobar el cuerpo de respuesta.

### 4.3 Ver logs / estado
```bash
docker compose logs -f backend
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
docker network ls
docker network inspect rsc-shared
```

### 4.4 Detener / limpiar
```bash
docker compose down        # solo este proyecto
docker stop 01_rsc_wpm_bun_psgres-backend 02_rsc_wp_bun_vue_frontend
docker rm 01_rsc_wpm_bun_psgres-backend 02_rsc_wp_bun_vue_frontend
```

---

## 5. Checklist de reutilización

- [ ] `.env` uses the configured backend hostname (currently `01_rsc_wpm_bun_psgres-backend:4001`), not `localhost` inside the frontend container.
- [ ] `docker-compose.yml` (dev) tiene `volumes: - .:/app`; `.prod.yml` no.
- [ ] `.dockerignore` excluye `tests/` (producción lean).
- [ ] `Dockerfile` `CMD` corre tests (`bun test`) o servidor (`bun run src/index.ts`) según fase; sin loop por `ConnectionRefused`.
- [ ] `backend` compose solo define `postgres` + `backend`; no incluye `frontend`.
- [ ] Shared network verified: the frontend Compose service must join the actual external network created by the backend Compose project; confirm the network name in both Compose files.
- [ ] `./project-tools/container-management.sh test-backend --container` passes from the backend container.
- [ ] `./project-tools/container-management.sh test-frontend` passes from the frontend container using its configured API_URL, with no localhost fallback on connection failure.
- [ ] Both container-origin suites verify `/health`, GET-by-ID, PUT persistence, and DELETE followed by 404.
- [ ] Postgres online: `pg_isready -U admin -d wpm_db`; tabla `usuario` en `wpm_db`.

---

## 6. Current API integration test workflow (verified 2026-10-02)

The backend and frontend each keep an API integration suite so each container independently validates its route to the backend. The backend test URL is `http://localhost:4001` from inside the backend container. The frontend test URL comes from `_02_rsc_wp_frontend/.env` and resolves the backend by its container hostname over the shared Compose network. A configured but unreachable `API_URL` is a test failure, not a signal to retry another host.

From the repository root, start the backend and database without removing the PostgreSQL volume, then run:

```bash
docker compose -f _01_rsc_wpm_backend/docker-compose.yml up -d backend
./project-tools/container-management.sh test-backend --container
./project-tools/container-management.sh test-frontend
```

For backend unit and API tests from the host, run:

```bash
cd _01_rsc_wpm_backend && bun run test:all
```

Both API suites cover `GET /health`, list/create and expected error responses, valid `GET /usuarios/:id`, `PUT /usuarios/:id` with a follow-up read, and `DELETE /usuarios/:id` with a follow-up 404. CRUD tests use unique email addresses and remove their created records. `/health` runs a database query: it returns 200 when PostgreSQL is reachable and 503 if that query fails. The 503 branch is implemented but was not fault-injected during this verification.

Observed verification:

- Backend local: 16 passed, 0 failed (36 assertions; handler unit tests and API tests).
- Backend-container API suite: 11 passed, 0 failed (28 assertions); 5 handler unit tests also passed locally.
- Frontend-container API suite: 11 passed, 0 failed (28 assertions), using `http://01_rsc_wpm_bun_psgres-backend:4001`.
- The backend image was rebuilt; the PostgreSQL container and named volume were left intact.

Older `4 pass` results and the earlier test command in sections 2 and 4 describe historical suites. They are not the current expected test count or complete CRUD coverage.

---

## 7. Referencias

- `local://docker-compose-dev-vs-prod-plan.md` (plan aprobado, idéntico contenido).
- `local://paste-1.md` (tutorial original — cubre `ConnectionRefused`, `docker compose run`, `.env`/red). Las secciones anteriores preservan resultados históricos; la sección 6 registra el flujo actual verificado.
- Archivo original interrumpido (`LEARNINGS/docker-microservices-containers-learnings.md`) reconstruido aquí con estructura completa.
