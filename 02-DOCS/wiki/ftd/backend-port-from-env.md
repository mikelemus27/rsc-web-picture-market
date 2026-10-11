# Backend server port from `PORT` env (fallback 4001)

- **Date**: 2026-10-10
- **Branch**: `chore/dev-backend-port-from-env` (from `dev` @ `c4fe304`)
- **Tracks**: GitHub issue #43; `TODO.md` → *Use `process.env.PORT` for backend server port*
- **Lane**: FTD (one doc, then tasks against observed proof)

## Intent

`_01_rsc_wpm_backend/src/index.ts` hardcoded `port: 4001` in `Bun.serve`, so the service could
not be told which port to listen on per environment (deployment, CI, local) — unlike `DB_PORT`,
which `src/infraestructura/database/postgres.ts` already reads with `Number(process.env.DB_PORT)
|| 5432`. The goal: the same env-with-fallback pattern for the server port, without changing
the default (4001) so local runs and the Compose mapping keep working untouched.

## Scope

### In
- `src/index.ts`: `port: 4001` → `port: Number(process.env.PORT) || 4001` (one line, same shape
  as the existing `DB_PORT` line).
- New `test/server-port.test.ts`: spawns `src/index.ts` with `PORT=45991`, polls `GET /health`
  on that port, asserts any HTTP answer (200 or 503) — proves the listener honours `PORT`.
- `BackEnd_README.md`: env-table `PORT` row default `3000` → `4001` (the row was stale: the API
  has listened on 4001 since long before; leaving `3000` would contradict this change).
- `TODO.md`: move the item to `## Completed` with evidence.

### Out
- No change to the default port when `PORT` is unset (4001 — covered by the whole existing API
  suite, which targets `http://localhost:4001`).
- No Compose change: the backend container keeps its `4001:4001` mapping; `PORT` is only an
  override hook for environments that need a different port.
- `commands.md` note ("El puerto 3000 es histórico: la API escucha en 4001") stays — it is
  already accurate.

## Checklist

- [x] 1. Failing test first: spawn with `PORT=45991` → server ignores it (stays on 4001) → test red.
- [x] 2. One-line change in `src/index.ts` → test green.
- [x] 3. `bunx tsc --noEmit` in the backend → 0 errors.
- [x] 4. `container-management.sh test-backend` (local) → 24 pass / 0 fail (11 unit + 1 new port test + 12 API).
- [x] 5. `rebuild-all` (image bakes `src/`) → backend recreated; live `GET /health` → 200.
- [x] 6. `container-management.sh test-backend --container` → 10 unit in-container + 13 API / 0 fail.
- [x] 7. `BackEnd_README.md` PORT row updated; `TODO.md` item → Completed.

## Evidence

Observed after the change, on branch `chore/dev-backend-port-from-env`:

| Check | Command | Result |
| --- | --- | --- |
| Red | `bun test test/server-port.test.ts` (before change) | 0 pass, 1 fail — server ignored `PORT=45991` |
| Green | same command (after change) | 1 pass, 0 fail |
| Typecheck | `bunx tsc --noEmit` | **exit 0, no output** |
| Unit + API local | `container-management.sh test-backend` | 24 pass, 0 fail, 54 expect() calls (includes the new spawn test; `server exited with code 143` = the test's own SIGTERM kill, not a failure) |
| Container build | `docker compose build --no-cache backend` + `up -d --force-recreate` | image built, container recreated |
| Live server | `curl http://localhost:4001/health` | `200` |
| API in container | `container-management.sh test-backend --container` | 13 pass, 0 fail, 34 expect() calls (+10 unit tests in-container, 0 fail) |

## Next step

Commit `feat(backend): read server port from PORT env with 4001 fallback` (code + test) and
`docs(todo): mark #3 done; add FTD; fix README PORT default` (docs) on this branch, push, and
open a PR against `dev` referencing issue #43 for the user to merge; close issue #43 manually
after merge (PR base is `dev`, so `Refs`/`Closes` keywords are ignored by GitHub).