# Comandos — backend (Bun + PostgreSQL)

Comandos **directos**: `docker`, `docker compose`, `psql`, `curl` y `bun`, tal cual se
ejecutan. Sin harness ni scripts intermedios.

Todos los ejemplos se ejecutan **desde este directorio** (`_01_rsc_wpm_backend/`), que es
donde vive `docker-compose.yml`. Desde la raíz del repo, añade
`-f _01_rsc_wpm_backend/docker-compose.yml` a cada `docker compose ...` (o usa
`--project-directory _01_rsc_wpm_backend`) y antepón `_01_rsc_wpm_backend/` a las rutas.

## Contexto del stack

| Qué | Valor actual |
| --- | --- |
| Servicio API | `backend` → contenedor `01_rsc_wpm_bun_psgres-backend`, host `4001` |
| Servicio DB | `postgres` → contenedor `01_rsc_wpm_backend-postgres`, host `5432` |
| Imagen DB | `postgres:16-alpine` |
| Base de datos | `wpm_db` |
| Tabla | `usuario` (singular) → `id`, `nombre`, `email` |
| Credenciales | `secrets/db_user.txt` y `secrets/db_password.txt` → montadas en `/run/secrets/`; nunca en variables de entorno ni en `inspect` |
| Red | `01_rsc_wpm_backend_rsc-network` (nombre real del `rsc-network` del proyecto) |
| Volumen | `01_rsc_wpm_backend_postgres_data` |
| Esquema inicial | `db/init/01-schema.sql` (se aplica **solo** si el volumen está vacío) |
| Host del backend visto desde el frontend | `01_rsc_wpm_bun_psgres-backend:4001` |

## Levantar y parar

```bash
docker compose up -d postgres          # solo la base de datos
docker compose up -d                   # el stack completo (db + api)
docker compose up -d --build           # reconstruye imágenes y levanta

# reconstrucción limpia de un servicio (sin caché de build)
docker compose build --no-cache backend
docker compose up -d --force-recreate backend

docker compose stop backend            # parar sin borrar
docker compose restart backend
docker compose down                    # baja el stack, CONSERVA el volumen
docker compose down -v                 # ⚠ borra postgres_data: se pierden TODOS los datos
```

## Estado y logs

```bash
docker compose ps                      # servicios del proyecto
docker compose ps --all                # incluye contenedores parados
docker compose logs -f backend         # seguir los logs de la API
docker compose logs --tail=50 postgres
docker compose top                     # procesos dentro de los contenedores
```

Salida actual esperada de `docker compose ps`:

```text
SERVICE    NAME                            STATUS                 PORTS
postgres   01_rsc_wpm_backend-postgres     Up (healthy)           0.0.0.0:5432->5432/tcp
backend    01_rsc_wpm_bun_psgres-backend   Up                     0.0.0.0:4001->4001/tcp
```

## Shells dentro de los contenedores

```bash
docker compose exec backend sh         # Alpine: sh, no bash
docker compose exec postgres bash      # Debian: bash
docker compose exec -T backend sh -c 'ls /app'
```

## PostgreSQL directo

```bash
# sesión interactiva (la conexión local del contenedor usa el socket interno, sin contraseña)
docker compose exec postgres psql -U "$(cat secrets/db_user.txt)" -d wpm_db

# comandos sueltos, sin entrar
docker compose exec -T postgres psql -U "$(cat secrets/db_user.txt)" -d wpm_db -c '\d usuario'
docker compose exec -T postgres psql -U "$(cat secrets/db_user.txt)" -d wpm_db -c 'select * from usuario;'
docker compose exec -T postgres psql -U "$(cat secrets/db_user.txt)" -d wpm_db -c 'select count(*) from usuario;'

# desde fuera, usando el puerto publicado 5432 (la contraseña se lee del fichero, no se imprime)
PGPASSWORD="$(cat secrets/db_password.txt)" psql -h localhost -p 5432 -U "$(cat secrets/db_user.txt)" -d wpm_db
```

Dentro de `psql`: `\dt` lista tablas, `\d usuario` describe la tabla, `\q` sale.

Estructura actual de la tabla (`db/init/01-schema.sql`):

```sql
CREATE TABLE IF NOT EXISTS usuario (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL
);
```

Recrear la base desde cero (⚠ pierde los datos):

```bash
docker compose down -v && docker compose up -d
```

## API con curl (puerto 4001)

```bash
curl -s localhost:4001/health
curl -s localhost:4001/usuarios
curl -s localhost:4001/usuarios/31
curl -si localhost:4001/usuarios          # -i: incluir cabeceras de respuesta

curl -s -X POST localhost:4001/usuarios \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Juan Pérez","email":"juan@example.com"}'

curl -s -X PUT localhost:4001/usuarios/31 \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Juan Pérez Actualizado","email":"juan.actualizado@example.com"}'

curl -s -X DELETE localhost:4001/usuarios/31

# solo el código de estado
curl -s -o /dev/null -w '%{http_code}\n' localhost:4001/ruta-inexistente
```

Respuestas observadas (stack levantado hoy):

```console
$ curl -s localhost:4001/health
{ "status": "ok" }                                  # http 200

$ curl -s localhost:4001/usuarios
[ { "id": 31, "nombre": "Prueba", "email": "prueba@test.com" } ]   # http 200

$ curl -s -o /dev/null -w '%{http_code}\n' localhost:4001/ruta-inexistente
404
```

Códigos esperados en el resto de rutas:

| Petición | Resultado |
| --- | --- |
| `POST /usuarios` válido | `201` + usuario creado |
| `POST /usuarios` email repetido | `409` |
| `POST`/`PUT` con campos ausentes o tipos inválidos | `400` |
| `GET`/`PUT`/`DELETE` de un id inexistente | `404` |
| `PUT` válido | `200` + usuario actualizado |
| `DELETE` válido | `200` + `{ "message": "Usuario eliminado", "usuario": { … } }` |
| Cualquier método en `/health` que no sea `GET` | `405` |

## Inspección y diagnóstico

```bash
# ¿los secretos se montan como ficheros y no como variables?
docker inspect 01_rsc_wpm_bun_psgres-backend --format '{{json .Mounts}}'
docker inspect 01_rsc_wpm_backend-postgres --format '{{json .Config.Env}}'
docker compose config                    # debe mostrar rutas /run/secrets/, nunca valores

# variables que ve la API
docker compose exec -T backend sh -c 'printenv | grep -E "^DB_"'

# ¿la imagen contiene solo el build?
docker compose exec -T backend sh -c 'ls /app'          # dist  node_modules

# ¿el contenedor sirve el código nuevo? (la imagen hornea src/ -> dist/)
docker compose exec -T backend sh -c 'grep -c handleHealth /app/dist/index.js'   # 2

# salud del motor y de la base
docker info --format '{{.ServerVersion}}'
docker compose exec postgres pg_isready -U "$(cat secrets/db_user.txt)" -d wpm_db
```

## Red y volúmenes

```bash
docker network ls
docker network inspect 01_rsc_wpm_backend_rsc-network
docker volume ls
docker volume inspect 01_rsc_wpm_backend_postgres_data

# ¿se ven entre contenedores? (desde el backend hacia la base)
docker compose exec -T backend sh -c 'getent hosts postgres'
```

## Local, sin contenedores

```bash
bun install
bun test                                # suite completa de test/
bun test test/health.test.ts            # un solo fichero
bunx tsc --noEmit                       # se espera salida vacía (0 errores)
bun run src/index.ts                    # requiere Postgres en localhost:5432 y el puerto 4001 libre
```

## Notas y trampas conocidas

- **La tabla es `usuario`, en singular.** `select * from usuarios;` falla con
  `ERROR: relation "usuarios" does not exist`.
- **La imagen hornea el código.** `Dockerfile` construye `dist/index.js` a partir de `src/`
  y solo los secretos se montan desde el host; por eso un cambio en el código **no** se
  sirve hasta reconstruir (`docker compose build --no-cache backend && docker compose up -d
  --force-recreate backend`). La comprobación de que el cambio llegó es un `grep` sobre
  `/app/dist/index.js`, no sobre `src/`.
- **`db/init/01-schema.sql` se ejecuta una sola vez**, cuando el volumen está vacío. Para
  volver a aplicarlo hay que borrar el volumen (`down -v`), y eso destruye los datos.
- **`docker` sin `sudo`**: el usuario del host está en el grupo `docker`. Si en tu máquina
  no lo está, antepón `sudo` a los comandos de Docker.
- **El puerto 3000 es histórico**: la API escucha en `4001` y la base publica `5432`.

## Lo que cambió respecto a la versión anterior de este documento

| Antes | Ahora |
| --- | --- |
| `http://localhost:3000` | `http://localhost:4001` |
| Base de datos `escuela` | `wpm_db` |
| Usuario y contraseña escritos en los comandos | `$(cat secrets/db_user.txt)` / `$(cat secrets/db_password.txt)` |
| Contenedor `06_practica-microservicio-bun_hexa_userapi_ok-postgres-1` | `01_rsc_wpm_backend-postgres` y `01_rsc_wpm_bun_psgres-backend` |
| `sudo docker …` | `docker …` |
| IP del contenedor vía `docker inspect` para conectarse | nombre de servicio `postgres` dentro de la red del proyecto |
| Transcripciones con la respuesta duplicada del `POST` (bug antiguo ya corregido) | Respuestas reales del stack actual |
