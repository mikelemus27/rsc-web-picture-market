# Docker Compose: Backend and Frontend Learnings
_Errores reales, causas y soluciones reutilizables — proyecto rsc-web-picture-market_

Historical operational notes for connecting the Bun backend, PostgreSQL, and frontend API tests. Compose settings and test outcomes change; inspect the current files and rerun commands before treating a snapshot below as current.

---

## 1. Arquitectura general

- **PostgreSQL** (`postgres:16-alpine`): DB `wpm_db`, usuario `admin`, contraseña `admin`.
- **Backend** (`_01_rsc_wpm_backend/`): Bun en `4001`, conecta a `postgres` por red Docker (`pg.Pool`, `DB_HOST: postgres`, no `localhost`).
- **Frontend (tests)** (`_02_rsc_wp_frontend/`): Bun que hace `fetch()` a `API_URL` (por defecto `http://localhost:4001`); en contenedor debe apuntar al servicio backend por nombre de red (`backend:4001` o `01_rsc_wpm_bun_psgres-backend:4001`).
- **Red Docker**: `rsc-network` (bridge) compartida; los contenedores se resuelven por nombre de servicio, no por `localhost`.

Reglas clave:
- Dentro de contenedor: `localhost` = ese mismo contenedor (nunca el backend).
- Entre contenedores: usar `nombre_servicio:puerto` (ej: `backend:4001`).
- `.env` debe usar el nombre del servicio backend, no `localhost`.

---

## 2. Errores resueltos (evidencia de esta sesión)

### 2.1 ConnectionRefused / FailedToOpenSocket al correr tests
**Síntoma:** `error: Unable to connect. Is the computer able to access the url? path: "http://localhost:4001/usuarios"`
**Causa:** `.env` default (`localhost:4001`) usa el contenedor del frontend como destino, no el backend.
**Solución:** `.env` → `API_URL=http://01_rsc_wpm_bun_psgres-backend:4001`; y asegurar red compartida (`rsc-shared` / `external: true`).
**Verificado:** `docker compose run --rm frontend bun test` → 4 pass, 0 fail.

### 2.2 Loop de reinicio del contenedor frontend (`Restarting (1)`)
**Síntoma:** `02_rsc_wp_bun_vue_frontend` reinicia cada ~17 segundos; `docker exec` dice "container is restarting".
**Causa:** `Dockerfile` tenía `CMD ["bun", "run", "src/index.ts"]` que fallaba al iniciar (conexión al backend fallida); Docker reiniciaba.
**Solución:** `Dockerfile` CMD → `CMD ["bun", "test", "./tests/usuarios.frontend.api.test.ts"]`; `.dockerignore` excluye `tests/` de imagen prod; `docker-compose.prod.yml` sin volumen; `docker-compose.yml` con `volumes: - .:/app` para dev.
**Resultado:** contenedor `Up` estable, sin `Restarting`.

### 2.3 Red aislada entre backend y frontend (diferente bridge)
**Síntoma:** `.env` correcto (`01_rsc_wpm_bun_psgres-backend:4001`), backend `Up`, pero `ConnectionRefused` persiste.
**Causa:** `docker-compose.yml` del backend crea `rsc-network`; `docker-compose.yml` del frontend crea otra instancia con mismo nombre pero diferente ID de red (aislamiento por proyecto Compose). `docker inspect` muestra IDs distintos (`31557...` vs `33bb...`).
**Solución:** usar `docker network create rsc-shared` (o `external: true` con `name: 01_rsc_wpm_backend_rsc-network`) y lanzar ambos contenedores con `--network rsc-shared`.
**Estado actual:** ambas redes alineadas (`rsc-shared`); `docker compose run --rm` usa la red del proyecto correctamente.

### 2.4 Backend test (`_01_rsc_wpm_backend/test/usuarios.api.test.ts`) no corre dentro del contenedor
**Síntoma:** `bun test` encuentra archivo pero `docker build` no lo incluye; `docker exec -T backend bun test ...` falló por no encontrar archivo.
**Causa:** `Dockerfile` backend (multi-stage) solo copia `dist/`; `.dockerignore` excluye `tests/`.
**Solución (para dev):** usar `docker compose run --rm backend bun test ...` con bind-mount o host local (archivo existe en directorio `_01_rsc_wpm_backend/test/`). No modificar imagen prod (de propósito lean).
**Resultado:** `2 pass, 2 fail` en host (`GET /usuarios` da 500 por código/DB; `POST` afirma formato); 2 pasan (`404`, `400`).

### 2.5 API tests fail because the PostgreSQL schema is missing
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
Nota: `CMD` cambia de `bun run src/index.ts` (loop de reinicio) a `bun test` (ejecuta y sale limpio; sin `Restarting`).

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
Nota: `volumes: - .:/app` solo en `docker-compose.yml` (dev); `.prod.yml` es imagen limpia.

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
Nota: `depends_on: - bun_app` eliminado para evitar duplicado con backend; frontend usa solo `env_file` + bind mount.

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
Nota: `backend` (antes `bun_app`) expone 4001; `postgres` expone 5433 al host.

---

## 4. Comandos verificados (resultados reales)

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

### 4.2 Ejecutar tests de frontend dentro del container(verificado 4 pass)
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

- [ ] `.env` usa nombre de servicio backend (`backend:4001`), no `localhost`.
- [ ] `docker-compose.yml` (dev) tiene `volumes: - .:/app`; `.prod.yml` no.
- [ ] `.dockerignore` excluye `tests/` (producción lean).
- [ ] `Dockerfile` `CMD` corre tests (`bun test`) o servidor (`bun run src/index.ts`) según fase; sin loop por `ConnectionRefused`.
- [ ] `backend` compose solo define `postgres` + `backend`; no incluye `frontend`.
- [ ] Red compartida verificada (`rsc-shared` / `external: true` / mismo `bridge`); `docker inspect` confirma misma red (o `docker network ls` confirma nombre común).
- [ ] `docker compose run --rm frontend bun test` pasa (4 pass) antes de considerar "funciona".
- [ ] Postgres online: `pg_isready -U admin -d wpm_db`; tabla `usuario` en `wpm_db`.

---

## 6. Referencias

- `local://docker-compose-dev-vs-prod-plan.md` (plan aprobado, idéntico contenido).
- `local://paste-1.md` (tutorial original — cubre `ConnectionRefused`, `docker compose run`, `.env`/red). Este documento mejora el original con verificación real (4 pass), lista de verificación, y corrección de la red (`rsc-shared`).
- Archivo original interrumpido (`LEARNINGS/docker-microservices-containers-learnings.md`) reconstruido aquí con estructura completa.
