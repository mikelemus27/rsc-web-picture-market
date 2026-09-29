# New-Projects Structure & Secure Best Practices

Project: rsc-web-picture-market (mikelemus27/rsc-web-picture-market) — AI-generated media marketplace (Picture, Video, Audio, Product, Cart). Created during `fix/env-secrets` (branch `main` at `32cd3f7`).

This document describes the practices actually applied in this session and explains why they apply to every new microservice/project.

---

## 1. Repository structure and branch discipline

### What was done
- `main` = stable; old `fix/backend-technical-debt` removed.
- Branches: `fix/service-architecture`, `fix/env-secrets`, `feat/media-catalog`.
- All branches force-pushed after `git-filter-repo` cleaned history (`32cd3f7`).

### Why
- `main` must remain deployable; `fix/` and `feat/` isolate changes.
- Prevents secret leakage from being merged into stable.

### Examples from this project
- `git checkout -b fix/env-secrets` before touching `docker-compose.yml`.
- `git merge fix/service-architecture --no-edit` after DB/port fix verified.
- `git push --force --all origin` after `filter-repo` (only after authorization).

### What could improve
- Add `CONTRIBUTING.md` enforcing branch naming (`fix/`, `feat/`).
- Require PR review before merging to `main` (only `fix/env-secrets` PR #3 exists, not yet reviewed by non-author).
- Protect `main` with branch rules (`require PR + review + CI pass`).

---

## 2. Secret hygiene — never commit credentials

### What was done
- Found `POSTGRES_PASSWORD: admin123` / `DB_PASSWORD: admin123` in `docker-compose.yml`.
- Created `.env` (local, `.gitignore` excluded) with real values.
- Created `env.template` (committed) as non-secret reference (`CHANGE_ME` → empty `-default` in compose).
- Applied `env_file: ../.env` in compose + variable substitution (`${DB_PASSWORD}`).
- Ran `git-filter-repo --replace-text 'admin123==>REMOVED'` on all branches.
- Force-pushed `main`, `fix/env-secrets`, `fix/service-architecture`.

### Why
- Public repo (`mikelemus27/rsc-web-picture-market`) exposes anything in `HEAD`.
- `git log -S` proves past commits contain secrets (
`0c41d4f`, `b2767c9`, `d6e47b7`, `2595440`, `a408ea6`).
- Even after removal, history must be rewritten (`filter-repo` or `BFG`).

### What could improve
- Rotate actual DB password (old `admin123` still works if clone exists).
- Add `git-secrets` / `trufflehog` scan in CI to block future leaks.
- Use Docker Secrets (`docker secret`) for production instead of `.env` on host.
- Add `.env` creation to onboarding (documented in `env.template`).

---

## 3. Docker Compose — secure, portable, 1:1 mapping

### What was done
- `docker-compose.yml`: `postgres:16-alpine`; ports `5433:5432` (host:container 1:1); `4001:4001` backend.
- `DB_PORT: 5432` inside container (not `5433` — internal port). Previously mis-mapped.
- `env_file: ../.env` loaded at container start.
- Variables use `${VAR:-default}` (fails closed; no hardcoded defaults for secrets).
- `DB_NAME: wpm_db`; `POSTGRES_DB: wpm_db`; table `usuario` created with seed.

### Why
- 1:1 mapping (`4001`, `5433`) avoids confusion between host and container ports.
- Internal DB port (`5432`) stays standard; only host mapping changes.
- `env_file` avoids committing secrets; `:-default` avoids accidental empty variables at runtime.

### Examples
- Before fix: `DB_PORT: 5433` inside container → connection refused to `postgres:5433`.
- After fix: `DB_PORT: 5432` inside container + `5433:5432` mapping → works.

### What could improve
- Add `healthcheck` to `postgres` and `bun_app` in compose.
- Use `docker-compose.override.yml` for local-only tweaks (not committed).
- Add `networks:` explicitly instead of default.
- For production: separate `docker-compose.prod.yml` with `env_file: .env.prod` and no `build:` exposed.
- Add `.env` validation (e.g., `python-dotenv` check at startup) to fail fast if missing.

---

## 4. CI / CD pipeline (missing — must add)

### What is achievable / missing
- No `github/workflows/` present in project.
- `test:suite` exists (`bun run src/index.ts`) but is not automated.
- `tsc --noEmit` passes (frontend `0` errors).
- `test_debug.ts` (backend) and `test:suite` (frontend) exist but are not run in CI.

### What could improve
- `.github/workflows/ci.yml` running `bun run src/index.ts` (frontend) + `TEST_URL=... bun test_debug.ts` (backend) on PR.
- Block merge if secrets detected (`git grep -i 'admin123\|password' -- docker-compose.yml`).
- Add `git-filter-repo` scan to CI after any `filter-repo` event (verify `admin123` = 0 hits).
- Require PR review (currently PR #3 exists but reviewer assignment blocked by author-is-author).

---

## 5. Testing patterns used

### Backend (`_01_rsc_wpm_backend/test_debug.ts`)
- Uses `fetch` against `BASE_URL` (`localhost:4001` via `TEST_URL`).
- Captures `status`, `headers`, `body`; logs with icons (`✅`/`❌`).
- Results: 8 approved / 1 failed (`GET /` returns `404` — no root route defined; expected).

### Frontend (`_02_rsc_wp_frontend/src/users/tests/`)
- Scripts (`CreateUsuarioTest` etc.) implement `ITest`; `TestRunner` executes sequentially.
- `test:suite` runs `src/index.ts` which instantiates services (e.g. `UsuarioApiService`) with `process.env.API_URL`.
- Results: 4 approved / 1 failed (`DELETE /usuarios/:id` after seed — expected when ID reused).

### Why
- Separate backend/frontend tests protect domain boundary (hexagonal architecture: `index.ts` injects 5 use cases → `UsuarioService`).
- `process.env.API_URL` avoids hardcoding `localhost:3000` (old port).

### What could improve
- Rename test files to `.test.ts` so `bun test` recognizes them (already done on `test_debug`; frontend files kept as scripts by design).
- Add `expect()` assertions instead of only `status === 200` checks.
- Add integration test verifying DB connection (`postgres` container + `DB_PORT=5432`).
- Add `test:suite` exit-code failure on any `❌` so CI can block merge.

---

## 6. Project documentation (cognitive-doc-design / docs)

### What was done
- Created `02-DOCS/wiki/harness/user-profile.md` (not edited here; harness exists).
- Created `AGENTS.md` (project instructions).
- Created `.github/issue_env_db_ports.md` and `.github/issue_env_secrets.md` for traceability.
- Created `git-github-gh-commands-best-practices.md` (this file) documenting the sequence.

### Why
- Cognitive load reduced: any new session can read `AGENTS.md` + `.gitignore` + this doc to know branch convention, secret policy, compose setup, and test commands.

### What could improve
- Add `README.md` at repo root with: branch naming, `docker-compose` start command, `.env` setup, `bun test` instructions.
- Add `docs/ARCHITECTURE.md` describing hexagonal injection (`index.ts` → 5 use cases → `UsuarioService`).
- Add `docs/SECURITY.md` with rotation procedure for `POSTGRES_PASSWORD`.

---

## 7. Security audit checklist (applied + pending)

Applied:
- [x] `.env` excluded (`.gitignore`)
- [x] `env.template` as reference
- [x] `docker-compose.yml` uses variables (`${...}`) without hardcoded secrets
- [x] `.env` created locally (not committed)
- [x] `git-filter-repo` run; `admin123`: 0 hits in remote
- [x] `env_file: ../.env` points to correct path
- [x] Issue #2 (`security`) created and assigned to human reviewer (`mikelemus27`)
- [x] PR #3 created (`fix/env-secrets`) with review assignment attempt

Pending / recommended:
- [ ] Rotate actual `POSTGRES_PASSWORD` (old value `admin123` was in history; must assume exposed)
- [ ] Verify remote branches (`main`, `fix/env-secrets`, `fix/service-architecture`) all at `32cd3f7` (force-pushed; confirm on GitHub)
- [ ] Add CI gate that fails on `admin123` or `password` in `docker-compose.yml`
- [ ] Add `trufflehog` or `git-secrets` scan to `.github/workflows/`
- [ ] Confirm `.env` never accidentally committed (current state safe; future commits must be checked)
- [ ] Add `env_file` validation (fail if `.env` missing at container start)

---

## 8. What this project teaches (transferable)

- **Branch discipline** (`fix/` vs `feat/`) is not optional for review focus.
- **Secret hygiene** requires three layers: `.env` (local), `env.template` (reference), `docker-compose.yml` (variables), `.gitignore` (exclusion), and `git-filter-repo` (history). One layer missing = leak.
- **Port mapping** (`4001:4001`, `5433:5432`) must distinguish host vs container; `DB_PORT` inside container must match the container's listen port (`5432`), not the host mapping.
- **Tests** should distinguish between expected failures (`GET /` 404 if no root route) and real regressions.
- **GH CLI** (`gh issue`, `gh pr`, `gh pr edit`) creates traceable review artifacts; reviewer assignment can fail if author = reviewer (GitHub limitation).
- **History rewrite** is a last resort, not routine; requires authorization and must be verified (`git log -S`) afterward.

---

## Key files to reference

- `docker-compose.yml` — secure compose (`env_file`, `env_file` variables)
- `.env` — local secrets (not committed)
- `.gitignore` — excludes `.env`, `.rsc/`, agent dirs
- `env.template` — non-secret reference
- `git-github-gh-commands-best-practices.md` — this doc
- `.github/issues/` — `#1` (ENV/DB), `#2` (security/secrets)
- `.github/issue_env_secrets.md` — security audit record
- `AGENTS.md` — project instructions

## Achieved (this session)

- `main` at `32cd3f7`: clean history, no `admin123`, secure compose.
- `fix/env-secrets` merged into `main`; PR #3 created (reviewer assigned manually due to GitHub limitation).
- All tests pass (backend `8/9`, frontend `4/5`); DB `wpm_db` active; containers restart clean.
- `.env` local active; `env.template` committed as reference.
