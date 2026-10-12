# Frontend backend port from a single source (root `./.env`)

- **Date**: 2026-10-11
- **Branch**: `refactor/dev-frontend-port-single-source` (from `dev` @ `19b34fb`)
- **Tracks**: GitHub issue #48; `TODO.md` → *Make the frontend derive the backend port from a single source*
- **Lane**: FTD (one doc, tasks checked off against observed proof)

## Intent

The frontend (`_02_rsc_wp_frontend`) is a one-shot CLI test client that calls the
backend over the Compose network. The port it targets was hardcoded in ~8 places
and read from the frontend's **own untracked** `_02_rsc_wp_frontend/.env`, so it
could drift from the backend single source — `PORT` in the root `./.env`
(issue #43 / #45). Goal: the frontend derives its target from that one value,
`container-management.sh test-frontend` stays green, and no scattered `4001`
fallback remains.

## Scope

### In
- New `src/core/config/apiConfig.ts` `apiBaseUrl()` — the one place a fallback
  port exists in the frontend.
- Six `src/*.ts` entrypoints, `src/users/tests/InvalidRouteTest.ts`, and
  `tests/usuarios.frontend.api.test.ts` derive their base URL from it.
- `docker-compose.yml` + `docker-compose.prod.yml`: `environment:` injects
  `PORT: ${PORT:-4001}` and `API_HOST: 01_rsc_wpm_bun_psgres-backend`; `env_file: .env` dropped.
- `project-tools/container-management.sh`: `frontend_fallback` injects
  `PORT`/`API_HOST` instead of `--env-file`; help text stops naming `4001`.
- `Dockerfile` (`EXPOSE 4001` removed), `FrontEnd_README.md`, root `README.md`.
- Local `_02_rsc_wp_frontend/.env` removed (it is no longer a config source).
- `TODO.md` item → Completed with evidence.

### Out
- Backend untouched (already single-sourced by #43 / #45).
- `API_URL` stays a supported **full** override (e.g. local runs
  `API_URL=http://localhost:4001 bun run ...`); it is no longer the committed path.
- TODO *Fix `InvalidRouteTest` hardcoded URL* — this change routes it through the
  shared helper; a constructor-injected base URL stays a separate refinement.

## Design

- **Single source**: root `./.env` `PORT`. `container-management.sh` already reads
  it and `export PORT` (lines 23–27), so `docker compose` interpolation sees it.
- **Why not `env_file`**: Compose does **not** interpolate `${}` inside an
  `env_file`, and a *missing* `env_file` is a hard Compose error
  (`env file ... not found`) — verified with Compose v5.5.1. So the value is built
  in `environment:` (which interpolation does reach) and `env_file` is removed.
- **Host vs port**: the port is the single-sourced value; the host
  (`01_rsc_wpm_bun_psgres-backend`) is a static Compose-network name, set in
  `environment:` (never in a `.env`).
- **Helper precedence** (`apiBaseUrl()`): `API_URL` (explicit full override) →
  `http://${API_HOST ?? "localhost"}:${PORT ?? "4001"}`. The single fallback
  constant lives only here, mirroring the backend's `process.env.PORT ?? 4001`.
- **Bun auto-load caveat**: the dev compose bind-mounts the frontend dir into
  `/app`, and Bun auto-loads `/app/.env`. A stale local `.env` would silently
  reintroduce the port, so the file is removed; the container gets its config from
  `environment:` instead.

## Tasks

- [x] T1 — Add `src/core/config/apiConfig.ts`; route the six `src/*.ts` and
  `src/users/tests/InvalidRouteTest.ts` through it. Done when no `"http://localhost:4001"`
  literal remains under `_02_rsc_wp_frontend/src`. — done: the only `4001` left is the
  helper's `DEFAULT_API_PORT`; every `http://localhost:4001` literal is gone.
- [x] T2 — Route `tests/usuarios.frontend.api.test.ts` through `apiBaseUrl()`.
  Done when the file has no literal `4001` fallback and still validates the protocol. — done.
- [x] T3 — Compose (dev + prod): add `environment:` `PORT`/`API_HOST`, drop
  `env_file: .env`; delete the local frontend `.env`. Done when
  `PORT=5055 docker compose -f … config` shows `PORT: "5055"` in the frontend env. — done.
- [x] T4 — `container-management.sh` fallback injects `PORT`/`API_HOST`; help text
  stops naming `4001`. Done when `sh -n` is clean and `test-frontend` still passes. — done.
- [x] T5 — `Dockerfile` `EXPOSE` removed; `FrontEnd_README.md` + root `README.md`
  updated; `TODO.md` item → Completed. — done (the dated "Onboarding 2026-09-30"
  snapshot was deliberately left untouched).

## Verification (canonical)

| Check | Command |
| --- | --- |
| Frontend suite | `./project-tools/container-management.sh test-frontend` |
| Interpolation (default) | `docker compose -f _02_rsc_wp_frontend/docker-compose.yml config` |
| Interpolation (override) | `PORT=5055 docker compose -f _02_rsc_wp_frontend/docker-compose.yml config` |
| Typecheck | `cd _02_rsc_wp_frontend && bunx tsc --noEmit` |
| Script syntax | `sh -n project-tools/container-management.sh` |

## Evidence

Observed on branch `refactor/dev-frontend-port-single-source` (`dev` @ `19b34fb`).

Commits: `22ae070` (shared helper + call sites), `022093c` (Compose dev+prod, management script, Dockerfile); this README/FTD/TODO record is the head commit of the branch.

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `cd _02_rsc_wp_frontend && bunx tsc --noEmit` | exit 0, no output |
| Interpolation (default) | `docker compose -f _02_rsc_wp_frontend/docker-compose.yml config` | frontend env `API_HOST: 01_rsc_wpm_bun_psgres-backend`, `PORT: "4001"`; **no** `env_file` |
| Interpolation (override) | `PORT=5055 docker compose -f … config` | frontend env `PORT: "5055"` |
| Frontend suite | `./project-tools/container-management.sh test-frontend` | **11 pass / 0 fail**, 28 `expect()` calls; every case resolved to `http://01_rsc_wpm_bun_psgres-backend:4001`, proving the target comes from the injected `PORT`/`API_HOST` |
| Script syntax | `sh -n project-tools/container-management.sh` | exit 0 |
| Literal scan | `grep -rn "4001" _02_rsc_wp_frontend/src …yml …prod.yml …Dockerfile` | 3 hits, all intentional: `DEFAULT_API_PORT` in the helper + `${PORT:-4001}` in each Compose file (the documented default, mirroring the backend) |

Notes from the run:

- The `grep` task wording ("nothing beyond the helper's one default") was imprecise: the
  `${PORT:-4001}` Compose default in each file is required by the design (and is what makes the
  `docker compose config` default case show `PORT: "4001"`), so it is a documented default rather
  than a scattered fallback. The six `http://localhost:4001` literals are all gone.
- `docker compose -f _02_rsc_wp_frontend/docker-compose.prod.yml config` **fails** with
  `service "frontend" refers to undefined network rsc-network`. Verified pre-existing on `dev`
  (the file never declared a top-level `networks:` block); out of scope here and backlogged in
  `TODO.md`.

## Next step

Commit the change as work-unit commits, run the native review, push
`refactor/dev-frontend-port-single-source` and open a PR targeting `dev` (issue #48).
The user merges.
