# New-Projects Structure & Secure Best Practices

Project: rsc-web-picture-market (mikelemus27/rsc-web-picture-market) — AI-generated media marketplace (Picture, Video, Audio, Product, Cart). Created during `fix/env-secrets` (branch `main` at `32cd3f7`).

This document describes the practices actually applied in this session and explains why they apply to every new microservice/project.

This is a historical record, not a live security or deployment status report. Check the current Compose files, environment configuration, branch state, and test outputs before relying on any present-tense claim below.

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
- Found plaintext database credentials in `docker-compose.yml`.
- Created `.env` (local, `.gitignore` excluded) with real values.
- Created `env.template` (committed) as non-secret reference (`CHANGE_ME` → empty `-default` in compose).
- Applied `env_file: ../.env` in compose + variable substitution (`${DB_PASSWORD}`).
- Ran `git-filter-repo --replace-text '<exposed-credential>==>REMOVED'` on all branches.
- Force-pushed `main`, `fix/env-secrets`, `fix/service-architecture`.

### Why
- Public repo (`mikelemus27/rsc-web-picture-market`) exposes anything in `HEAD`.
- `git log -S` showed past commits contained credentials (
`0c41d4f`, `b2767c9`, `d6e47b7`, `2595440`, `a408ea6`).
- Even after removal, history must be rewritten (`filter-repo` or `BFG`).

### What could improve
- Rotate credentials that were ever committed. Rewriting Git history does not invalidate a credential or remove copies from existing clones.
- Add `git-secrets` / `trufflehog` scan in CI to block future leaks.
- Use Docker Secrets (`docker secret`) for production instead of `.env` on host.
- Add `.env` creation to onboarding (documented in `env.template`).

---

## 3. Docker Compose — secure, portable, 1:1 mapping

### Historical state recorded
- The Compose setup used PostgreSQL on container port `5432` and the backend on `4001`; host-side port mappings changed over time.
- The backend connects to the Compose service hostname on its internal PostgreSQL port, regardless of the host-side port mapping.
- The database name was `wpm_db`.
- The table `usuario` was not automatically present in a newly initialized database during the later test-failure incident. The current schema initialization notes and evidence are in [`postgresql-learnings.md`](./postgresql-learnings.md).

Do not treat this section as confirmation that current Compose files use environment substitution or contain no plaintext credentials. Audit the checked-out configuration before making a security claim.

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

## 4. CI / CD pipeline (historically missing; re-check before acting)

### What is achievable / missing (historical snapshot)
- No `github/workflows/` was present when this note was written. The repository scan on 2026-10-02 found no workflow files.
  - **Update 2026-10-06:** two workflows now exist on `dev` — `validate-labels.yml` (validation gate, `contents: read`) and
    `sync-labels.yml` (label applier, `issues: write`). Both are scoped by `paths:` to label governance only. There is still
    **no build/test CI** — nothing runs `bun` tests or `tsc --noEmit` on a pull request. Inspect `.github/workflows/` again
    before adding CI, and expect to add the missing test workflow rather than discover one.
- The original notes recorded a `test:suite` command (`bun run src/index.ts`) that was not automated.
- The original notes recorded `tsc --noEmit` passing (frontend `0` errors).
- The original notes recorded `test_debug.ts` (backend) and `test:suite` (frontend) as not run in CI. These commands/results are historical; use current READMEs for supported test commands.

### What could improve
- `.github/workflows/ci.yml` running `bun run src/index.ts` (frontend) + `TEST_URL=... bun test_debug.ts` (backend) on PR.
- Add a secret-scanning CI gate; searching for a generic key name such as `password` is too broad to reliably identify leaked values.
- After a history rewrite, verify that the exposed value no longer appears in refs or remote history; do not treat that as credential rotation.
- Require PR review (currently PR #3 exists but reviewer assignment blocked by author-is-author).

---

## 5. Testing patterns used in the original session (historical)

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
- [x] Add a root `README.md` with project startup, test commands, and links to deeper project documentation. Current instructions are in [`README.md`](../README.md).
- Add `docs/ARCHITECTURE.md` describing hexagonal injection (`index.ts` → 5 use cases → `UsuarioService`).
- Add `docs/SECURITY.md` with rotation procedure for `POSTGRES_PASSWORD`.

---

## 7. Historical security checklist (not current-state evidence)

The checkmarks below record claims from the original security work. They do not establish current configuration or remote history. In particular, the current backend Compose file still contains inline development database credentials; the root README warns contributors to replace them before sharing or deploying. Do not copy secret values into this learning note.

Applied:
- [x] `.env` excluded (`.gitignore`)
- [x] `env.template` as reference
- [x] (Historical claim; not true of the current Compose configuration.) At the time, `docker-compose.yml` was reported to use variables (`${...}`) without hardcoded secrets.
- [x] `.env` created locally (not committed)
- [x] History rewrite was performed; verify current remote history before relying on this historical result.
- [x] `env_file: ../.env` points to correct path
- [x] Issue #2 (`security`) created and assigned to human reviewer (`mikelemus27`)
- [x] PR #3 created (`fix/env-secrets`) with review assignment attempt

Pending / recommended:
- [ ] Confirm that credentials ever committed have been rotated; assume exposed until confirmed.
- [ ] Verify remote branches (`main`, `fix/env-secrets`, `fix/service-architecture`) all at `32cd3f7` (force-pushed; confirm on GitHub)
- [ ] Add secret-scanning CI gate for committed configuration and history.
- [ ] Add `trufflehog` or `git-secrets` scan to `.github/workflows/`
- [ ] Confirm `.env` never accidentally committed (current state safe; future commits must be checked)
- [ ] Add `env_file` validation (fail if `.env` missing at container start)

---

## 8. Docker Compose secrets vs env_file — what actually protects what

### The mechanism matters, not the file extension

| Mechanism | What Docker does | Visible in `docker inspect`? | Visible in `ps e`? |
|---|---|---|---|
| `env_file: .env` | Parses file, sets **environment variables** | Yes — password in plaintext | Yes |
| `secrets: file: ./secrets/db_password.txt` | Mounts file as **read-only file** at `/run/secrets/` | No — only file path shown | No |

The file extension (`.txt` vs `.env`) makes no difference. What matters is the **mechanism**: `secrets:` mounts a file, `env_file:` sets an env var.

### Honest threat model — what Docker secrets do and don't protect against

**Docker secrets do NOT protect against:**
- An attacker with `docker exec` access (they can `cat /run/secrets/db_password`)
- An attacker with Docker socket access (they can read the file on the host)
- Someone who can read application logs (if the app logs the secret)

**Docker secrets DO protect against:**
- `docker inspect` leaking the password (only shows file path, not content)
- `docker compose config` leaking the password
- `ps e` on the host showing the password
- Crash dumps / error trackers that capture env vars
- Accidental logging of environment variables

**The real security boundaries** (in priority order):
1. Don't commit secrets to Git — the biggest risk
2. Limit Docker socket access — only trusted users should have `docker` CLI access
3. Rotate credentials — if a secret was ever exposed, change it
4. Network isolation — the database isn't reachable from outside the Compose network
5. Principle of least privilege — the backend only gets the password, not the whole env

### Docker Compose secrets implementation plan (for this project)

**Architecture:**
```
_01_rsc_wpm_backend/
├── secrets/                        # gitignored
│   ├── db_user.txt                 # Contains: admin
│   └── db_password.txt             # Contains: <new-password>
├── docker-compose.yml              # uses secrets: block
├── docker-entrypoint.sh            # bridges secret files → env vars (for backend)
└── ...
```

**How it works:**
1. Secret files live in `_01_rsc_wpm_backend/secrets/` (gitignored)
2. `docker-compose.yml` defines them using `secrets:` block with `file:`
3. PostgreSQL uses `POSTGRES_USER_FILE` and `POSTGRES_PASSWORD_FILE` (official image supports `_FILE` variants)
4. Backend uses an entrypoint script that reads `/run/secrets/db_password` and exports it as `DB_PASSWORD` — avoids modifying application code
5. Secrets are mounted as read-only files at `/run/secrets/` — never appear in `docker inspect` or `ps e`

**Alternative (cleaner, no entrypoint script):**
- Modify `postgres.ts` to read `DB_PASSWORD_FILE` and use `Bun.file()` to read the secret file directly
- The password never becomes an env var — strictly more secure
- Requires a few lines of code change in the application

**Credential rotation is mandatory:**
- The `admin123` password has been committed to Git history
- Generate a new strong password, put it in `secrets/db_password.txt`
- The old `admin123` in Git history should be considered compromised
- If the repo is ever shared or pushed to a remote, history should be rewritten (separate, careful operation)

### Key lessons learned

- **Docker secrets are defense-in-depth, not a silver bullet.** They prevent common operational mistakes (the most common way secrets leak) but don't stop a determined attacker with container access.
- **`env_file: .env` is acceptable for dev** when the `.env` is gitignored and credentials are rotated — but `secrets:` is strictly better for production.
- **The file extension is irrelevant** — `.txt` and `.env` work identically with the `secrets:` block. Choose based on team convention.
- **PostgreSQL natively supports `_FILE` env vars** (`POSTGRES_PASSWORD_FILE`, `POSTGRES_USER_FILE`) — no entrypoint script needed for the database service.
- **For the Bun backend, prefer modifying the app** to read `DB_PASSWORD_FILE` over an entrypoint script — it's cleaner and keeps the secret as a file end-to-end.

---

## 9. What this project teaches (transferable)

- **Branch discipline** (`fix/` vs `feat/`) is not optional for review focus.
- **Secret hygiene** needs separate safeguards: ignored local configuration or managed secrets, non-secret setup documentation, secret exclusion, rotation after exposure, and careful history handling. Verify the current configuration; a history rewrite does not rotate credentials.
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

## Achieved in the original `fix/env-secrets` session (historical)

- At the time of this record, `main` was reported at `32cd3f7` after a history rewrite. This does not establish the current history state or credential safety.
- `fix/env-secrets` merged into `main`; PR #3 created (reviewer assigned manually due to GitHub limitation).
- All tests pass (backend `8/9`, frontend `4/5`); DB `wpm_db` active; containers restart clean.
- `.env` local active; `env.template` committed as reference.

## Learnings reviewed on 2026-10-02

- [x] A root `README.md` now documents project startup, backend-local tests, and separate backend-container and frontend-container API test commands. The older recommendation to create it is complete.
- The repository now has a tracked root `TODO.md`, linked from `README.md`, for follow-up work that must survive across agent sessions. Session-local TODO entries alone are not persistent project backlog.
- Current backend and frontend API suites independently test network reachability, `/health`, GET-by-ID, PUT persistence, and DELETE followed by 404. A configured `API_URL` failure does not silently fall back to localhost.
- The backend Compose file still has inline development credentials. Rewriting Git history does not rotate a credential; replace inline values with ignored local configuration or managed secrets before sharing/deploying, and rotate any credential that was exposed.
- Today's verification covered backend-local tests (16 passed), backend-container API tests (11 passed plus 5 local handler unit tests), frontend-container API tests (11 passed), and `git diff --check`. The `/health` 503 failure branch remains untested and is listed in [`TODO.md`](../TODO.md).
