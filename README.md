# RSC Web Picture Market

A web application to showcase and sell AI-generated pictures, videos, and audio files. Users browse a gallery, view details, add items to a cart, and complete purchases via a REST API backend (`Bun` + PostgreSQL).

## Objective

Marketplace for AI-generated media (`Picture`, `Video`, `Audio`), with `Product`, `CartItem`, and `Order` entities. Backend uses hexagonal architecture (`Clean Architecture` / ports-adapters); frontend is a `Vue 3` CLI (`test:suite` via `bun run src/index.ts`).

Source of truth for this repo: `AGENTS.md`, `02-DOCS/ftd/rsc-web-picture-market.md`, `LEARNINGS/` tutorials.

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Backend runtime | `Bun` (`_01_rsc_wpm_backend/src/index.ts`) | Hexagonal: `Controller` → `Service` → `Repository` (`postgres`) |
| Database | `PostgreSQL:16-alpine` (`docker-compose.yml`) | Internal port `5432`; host mapping `5433:5432`; DB `wpm_db` |
| Backend port | `4001` (`docker-compose.yml`: `4001:4001`) | `DB_HOST=postgres`, `DB_PORT=5432` |
| Frontend CLI | `_02_rsc_wp_frontend/` (`bun`, TypeScript) | `Vue 3` (`package.json`: `test:suite` = `bun run src/index.ts`) |
| Design tokens / patterns | `tailwind-design-system` skill installed (`.agents/skills/`) | Used for responsive patterns |
| Review / workflow | `git-flow` skill installed (`.agents/skills/`) | Branch naming (`main`, `fix/`, `feat/`) |
| Tests (backend) | `test_debug.ts` (manual fetch) + `test/usuarios.api.test.ts` (TDD `bun:test`) | `TEST_URL=http://localhost:4001` |
| Tests (frontend) | `tests/usuarios.frontend.api.test.ts` (TDD parallel, moved out of `src/`) | `API_URL=http://localhost:4001` |

## Directory Structure

```
rsc-web-picture-market/
├── .github/issue_env_db_ports.md         # Issue #1 (ENV/DB mapping)
├── .github/issue_env_secrets.md           # Issue #2 (security / secrets)
├── .github/issue_refactor_tdd.md          # Issue #4 (TDD backend)
├── .github/issue_refactor_tdd_frontend.md # Issue #6 (TDD frontend)
├── .env                                    # Local secrets (NOT committed)
├── env.template                            # Non-secret reference
├── docker-compose.yml                     # Secure compose (`env_file: .env`, variables)
├── git-github-gh-commands-best-practices.md  # Tutorial: git/gh CLI + security sequence
├── new-projects-structure-n-secure-bests-practices.md  # Tutorial: architecture + best practices
├── LEARNINGS/                             # Session tutorials (not in repo by default; added here)
│   ├── git-github-gh-commands-best-practices.md
│   └── new-projects-structure-n-secure-bests-practices.md
├── _01_rsc_wpm_backend/                   # Backend (Bun + PostgreSQL)
│   ├── docker-compose.yml                 # Ports: 4001:4001; DB: 5433:5432
│   ├── package.json                       # Scripts: test / test:full (TDD)
│   ├── src/index.ts                        # Hexagonal DI: 5 use cases → UsuarioService
│   ├── src/main.ts
│   ├── test/usuarios.api.test.ts          # TDD parallel (4 pass / 0 fail)
│   └── test_debug.ts                       # Manual fetch-based test (8/9 pass)
└── _02_rsc_wp_frontend/                   # Frontend CLI (Vue 3 + Bun)
    ├── package.json                       # test:suite + users:* scripts
    ├── src/index.ts                        # Test runner + DI
    ├── src/users/services/UsuarioApiService.ts
    ├── src/users/tests/CreateUsuarioTest.ts  # Original files (restored)
    ├── src/users/tests/DeleteUsuarioTest.ts
    ├── src/users/tests/GetUsuariosTest.ts
    ├── src/users/tests/GetUserByIDTest.ts
    ├── src/users/tests/UpdateUsuarioTest.ts
    ├── src/users/tests/InvalidRouteTest.ts
    └── tests/usuarios.frontend.api.test.ts  # TDD parallel (moved out of src/; 4/4 pass)
```

## Architecture (Hexagonal / Ports-Adapters)

`_01_rsc_wpm_backend/src/index.ts` implements hexagonal architecture:

```
Controller (UsuarioController, input/http)
  ↓
Service (UsuarioService, aplicacion/services)
  ↓
Repository (UsuarioRepositoryImpl, output/postgres_sql)
  ↓
PostgreSQL (`postgres` service, `DB_NAME=wpm_db`)
```

Use cases injected (`Crear/Obtener/Listar/Actualizar/Eliminar`). All 5 cases verified in `index.ts`. `main.ts` is auxiliary/dev (older errors: service constructor mismatch); the Docker entrypoint is `index.ts`.

## Security / Secret Policy

- `.env` (local) excluded by `.gitignore` (`.env`, `.env.local`, `.env.production`).
- `.env` exists at repo root with working values (`POSTGRES_USER=admin`, `DB_PASSWORD=...`, `DB_NAME=wpm_db`).
- `env.template` is non-secret reference (`CHANGE_ME` removed after fix; variables now use `${VAR}` without sensitive defaults).
- `docker-compose.yml`: no `admin123` in `HEAD` (`filter-repo` applied: `0 hits` of `admin123` across `main` + branches).
- `.env` never in `HEAD`; `.env` preserved locally; `.rsc/` runtime excluded; agent dirs excluded.
- `POSTGRES_DB: wpm_db`; `DB_PORT: 5432` (internal container port); host mapping `5433:5432`.
- Issue #2 (`security`) documents the leak; PR #3 (`fix/env-secrets`) fixes it.

## Development Commands

### Start backend + DB (with `.env`)
```bash
cd _01_rsc_wpm_backend
docker compose up -d --build
```

### Backend tests
```bash
# TDD (parallel file, 4 pass / 0 fail)
TEST_URL=http://localhost:4001 bun test test/usuarios.api.test.ts
# Manual (original file, 8/9 pass; GET / 404 expected)
TEST_URL=http://localhost:4001 bun run test_debug.ts
```

### Frontend tests
```bash
cd _02_rsc_wp_frontend
# TDD parallel (moved out of src/; 4 pass / 0 fail)
API_URL=http://localhost:4001 bun test tests/usuarios.frontend.api.test.ts
# Original script-based test suite (4/5 pass; DELETE 404 expected after seed)
API_URL=http://localhost:4001 bun run src/index.ts  # (test:suite)
```

### Container restart (after `.env` or compose changes)
```bash
docker compose -f _01_rsc_wpm_backend/docker-compose.yml down --remove-orphans
docker compose -f _01_rsc_wpm_backend/docker-compose.yml up -d --build
```

### Typecheck (frontend, 0 errors)
```bash
cd _02_rsc_wp_frontend
bun run typecheck  # tsc --noEmit
```

### TDD commands (package.json updated)
```bash
cd _01_rsc_wpm_backend
bun test              # TDD parallel file
TEST_URL=http://localhost:4001 bun test test:full  # full TDD run
```

### Branch / commit conventions
```bash
# Feature branch
npx @ericrisco/rsc add git-workflow
# Standard branches
main  (stable) | fix/<topic> | feat/<topic>
```

### Review workflow (used in this session)
```bash
# Create / edit PR
npx @ericrisco/rsc@latest add git-workflow
git checkout -b fix/env-secrets
gh pr create --repo mikelemus27/rsc-web-picture-market --head fix/env-secrets --base main --title ...
gh pr edit <n> --add-reviewer mikelemus27
# Note: GitHub blocks author = reviewer; manual UI assignment required.
```

### Secret hygiene (sequence applied in this session)
1. `.env` created (local, excluded by `.gitignore`).
2. `.env` copied to compose dir (`.env`); compose updated (`env_file: .env`).
3. `env.template` created (non-secret reference; `CHANGE_ME` removed).
4. `docker-compose.yml`: variables (`${POSTGRES_PASSWORD}` etc.) without sensitive defaults.
5. `git-filter-repo --replace-text 'admin123==>REMOVED' --force --partial` applied (`main`, `fix/env-secrets`, `fix/service-architecture` rewritten to `32cd3f7`; `0 hits` of `admin123`).
6. `.env` preserved locally; never in `HEAD` of any branch.

### Issue / PR / Review lifecycle (applied)
- Issue #1 (`ENV/DB`) — assigned to `mikelemus27` (`.env` + port mapping).
- Issue #2 (`security`) — assigned; `admin123` removed from `docker-compose.yml`.
- Issue #4 (`TDD`) — assigned; `test/usuarios.api.test.ts` created (parallel, originals untouched).
- Issue #6 (`Frontend TDD`) — assigned; `tests/usuarios.frontend.api.test.ts` created (outside `src/`).
- PR #3 (`fix/env-secrets`) — open.
- PR #5 (`fix/tdd-test-suite`) — open.
- PR #7 (`fix/tdd-test-suite-frontend`) — open.

### Container / DB health
```bash
# Current state (verified after rebuild + restart):
# - Backend port: 4001 (1:1 mapping: 4001:4001)
# - DB host port: 5433 (mapping: 5433:5432; container internal: 5432)
# - DB name: wpm_db
# - DB table: usuario (id SERIAL PRIMARY KEY, nombre VARCHAR(100), email VARCHAR(100))
# - Seed: Usuario Test Actualizado / test email (multiple runs accumulate; 10-33+ registros expected)
# - Container health: bun_app responds (`GET /usuarios` = 200), postgres accepts connections
```

## Security / Audit Checklist (applied in session + pending)

Applied (`main` / branches / PR):
- [x] `.env` excluded (`.gitignore`)
- [x] `env.template` non-secret reference (`CHANGE_ME` -> removed after filter)
- [x] `docker-compose.yml`: `env_file: ../.env` (later `.env` in compose dir) + variables without sensitive defaults
- [x] `.env` never in `HEAD` (`.env` preserved locally only)
- [x] `git-filter-repo` applied (`0 hits` of `admin123` in remote branches)
- [x] `.github/issue_env_db_ports.md` (tracking ENV mapping)
- [x] `.github/issue_env_secrets.md` (security audit documentation)
- [x] `test/usuarios.api.test.ts` (parallel TDD; original `test_debug.ts` untouched)
- [x] `tests/usuarios.frontend.api.test.ts` (outside `src/`; originals untouched)
- [x] `package.json` scripts (`test`, `test:full`, `test:tdd`) with `TEST_URL` env

Pending / recommended improvements:
- [ ] Rotate actual `POSTGRES_PASSWORD` (old assume exposed; `filter-repo` rewrote to `REMOVED` but actual DB should use new secret).
- [ ] Verify remote `main` pushed (`c394b64` -> `e5d630e` — `main` has docs commit `c394b64`; filter-repo rewrote `main` to `32cd3f7`; `main` currently at `e5d630e` with docs but needs final `push` to sync filter-rewritten branch to `32cd3f7`).
- [ ] Confirm remote `.env` never committed (`.gitignore` covers `.env` + `.env.local` + `.env.production`).
- [ ] Add `.github/workflows/ci.yml` (run `test_debug` / `test:full` on PR; block on  `password` grep failure).
- [ ] Add `docs/SECURITY.md` (rotation procedure; `env.template` reference).

## Running the application (quick start)

```bash
# 1. Clone / navigate
cd rsc-web-picture-market

# 2. Create local secrets (from env.template; rotate BEFORE deploying to public)
cp env.template .env
# Edit .env: set real POSTGRES_PASSWORD / DB_PASSWORD (not admin123)

# 3. Build and run (backend + DB)
cd _01_rsc_wpm_backend
docker compose up -d --build

# 4. Verify health
curl -s -o /dev/null -w "%{http_code}" http://localhost:4001/usuarios  # 200

# 5. Run tests (backend TDD parallel file — does NOT touch original test files)
TEST_URL=http://localhost:4001 bun test test/usuarios.api.test.ts

# 6. Run frontend suite (original script-based; .test. versions exist but are parallel references)
API_URL=http://localhost:4001 bun run src/index.ts  # test:suite
# Or run TDD parallel files:
TEST_URL=http://localhost:4001 bun test tests/CreateUsuarioTest.test.ts  # (only if renamed to .test.)
# Note: .test. versions of original scripts are references; the TDD parallel is test/usuarios.api.test.ts (backend) and tests/usuarios.frontend.api.test.ts (frontend).
```

## References

- `02-DOCS/ftd/rsc-web-picture-market.md` — feature document (Picture, Video, Audio, Product, Cart, Order entities; hexagonal design).
- `AGENTS.md` — always-on harness layer (lane classification + session equipment).
- `git-github-gh-commands-best-practices.md` — git/gh CLI sequence (branch naming, commit, PR, filter-repo).
- `new-projects-structure-n-secure-bests-practices.md` — this doc (security, architecture, CI recommendations).
- `.github/issue_refactor_tdd.md` — Issue #4 (TDD backend).
- `.github/issue_env_secrets.md` — Issue #2 (security audit).
- `.github/issue_env_db_ports.md` — Issue #1 (ENV/DB mapping; port `5432` internal, `4001` backend).
- `.github/issue_refactor_tdd_frontend.md` — Issue #6 (TDD frontend).
--- << Project Tools explanation >> ---

The project uses ./project-tools/container-management.sh (POSIX sh) for container lifecycle (start-all / stop-all / rebuild-all / test-frontend / test-backend / help).
Verified: docker compose run --rm frontend bun test ./tests/usuarios.frontend.api.test.ts => 4 pass, 0 fail.
Requires: .env (API_URL=http://01_rsc_wpm_bun_psgres-backend:4001), .dockerignore (tests/), Dockerfile CMD (bun test), rsc-shared network.
