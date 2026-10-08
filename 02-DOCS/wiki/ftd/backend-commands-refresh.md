# Refresh `_01_rsc_wpm_backend/commands.md` to the current stack

- **Date**: 2026-10-08
- **Branch**: `docs/dev-refresh-backend-commands` (from `dev` @ `e969486`)
- **Lane**: FTD (docs-only, no runtime change)

## Intent

`commands.md` is the backend's quick-reference sheet, but it documents a stack that no
longer exists: host port `3000`, database `escuela`, a hardcoded `admin` credential, the
container name `06_practica-microservicio-bun_hexa_userapi_ok-postgres-1`, `sudo docker`,
and a container-IP lookup that the Compose network made unnecessary. Several pasted
transcripts also preserve an old double-encoded `POST /usuarios` response — a bug that was
fixed long ago, so the sheet documents broken behaviour as if it were current.

## Scope

### In
- Rewrite `commands.md` in place against the observed current stack.

### Out
- No source, Compose, Dockerfile or script changes.
- No `project-tools/` harness or script references inside the document: the user's
  requirement is that these stay **direct** commands (`docker`, `docker compose`, `psql`,
  `curl`, `bun`) that can be pasted and run as-is.
- `TODO.md` bookkeeping is deliberately skipped: the open PR #27 edits the same
  `## Completed` region, and a second writer there would only manufacture a conflict. The
  file will be updated once #27 lands.

## Decisions

1. **Keep the paste-and-run character.** Every command is written to work verbatim from
   `_01_rsc_wpm_backend/`, with the root-relative `-f` variant noted once instead of
   repeated on every line.
2. **No credential literal appears anywhere in the document** — the `psql` lines read the
   user from `secrets/db_user.txt` via `$(cat …)`, which both works today and demonstrates
   the pattern the *Externalize and rotate database credentials* item is driving at.
   Password is never printed or passed on a command line (it arrives through
   `PGPASSWORD`/`*_FILE` inside the container).
3. **Replace the stale transcripts with outputs captured from the live stack**, so every
   example in the sheet is true on the day it is written. Read-only commands only
   (`ps`, `psql \d`, `select`, `/health`, `GET /usuarios`, a 404 probe) — the sheet must not
   mutate the database just to illustrate a `POST`. Write endpoints are documented with
   their expected status codes instead.
4. **Keep the gotchas that teach something**: the table is `usuario` (singular) so
   `select * from usuarios` fails; the image bakes `src/` into `dist/`, so a code change
   needs a rebuild before it is served; `down` keeps the volume, `down -v` destroys it.
5. **Documented extras** the previous sheet lacked: rebuild/force-recreate, logs, `exec`
   shells, secret-mount inspection, network/volume inspection, and the deployed-code check
   (`grep -c handleHealth /app/dist/index.js`) that proves a rebuild actually shipped.

## Checklist

- [x] 1. Capture the real container names, ports, network, volume and schema.
- [x] 2. Rewrite `commands.md` with direct commands for the current stack.
- [x] 3. Verify every documented command runs as written (read-only ones executed).
- [x] 4. Verify no stale string survives (`3000`, `escuela`, `06_practica`, `admin` literal).
- [x] 5. Verify no credential value appears in the file.

## Evidence

| Check | Result |
| --- | --- |
| `docker compose ps` | `01_rsc_wpm_backend-postgres` (healthy, `5432:5432`) + `01_rsc_wpm_bun_psgres-backend` (`4001:4001`) |
| `psql \d usuario` | 3 columns (`id` PK serial, `nombre`, `email` UNIQUE NOT NULL) — matches `db/init/01-schema.sql` |
| `select * from usuario` | 1 row of test data (`prueba@test.com`) |
| `curl localhost:4001/health` | `200` `{ "status": "ok" }` |
| `curl localhost:4001/usuarios` | `200` + JSON array |
| `curl localhost:4001/ruta-inexistente` | `404` |
| `docker compose exec backend grep -c handleHealth /app/dist/index.js` | `2` — deployed-code check works |
| Stale strings | `grep -n '3000\|escuela\|06_practica'` → only the intentional "what changed" table at the end |
| Credentials in the sheet | `grep -cF "$(cat secrets/db_password.txt)" commands.md` → **0**; no `admin` literal either |
| Credentials in Compose | `docker compose config` → 8 `/run/secrets/` paths, **0** password occurrences; `printenv \| grep ^DB_` in the container → only `*_FILE` paths |
| Every documented command | executed end to end: `ps`, `top`, `logs`, `exec`, `psql` (`\d usuario`, `select`), `pg_isready`, `getent hosts postgres`, `docker inspect` (Mounts + Env), `docker compose config`, `network`/`volume inspect`, all `curl` probes, `bun test`, `bunx tsc --noEmit` |
| `bun test` (plain, as documented) | 21 pass, 0 fail — matches the sheet |
| Backend, container mode | `container-management.sh test-backend --container` → 10 unit pass + 11 API pass = **21 pass, 0 fail** |
| Frontend suite | `container-management.sh test-frontend` → 11 pass, 0 fail, exit 0 |
| Database checks | `bash project-tools/db-healthcheck.sh` → **8/8 checks passed** (`wpm_db`, table `usuario`, 1 row, schema and constraints OK) |
| Shell harness | `project-tools/tests/container-management.test.sh` → All 13 assertions passed |

The full battery was re-run **on this branch** rather than inherited from the previous one: **53 green
checks** (backend 21 + frontend 11 + harness 13 + db-healthcheck 8). A docs-only change cannot break
them, but the sheet describes this exact stack, so its claims are backed by a live run.
| Internal DNS | `getent hosts postgres` → `192.168.0.2 postgres` (service name resolves) |

## Next step

Commit, push, PR against `dev`.
