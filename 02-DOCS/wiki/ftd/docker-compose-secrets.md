# Docker Compose secrets (SECURE_SECRETS_PLAN.md)

## Intent

Remove inline credentials (`POSTGRES_PASSWORD: <rotated>`, `DB_PASSWORD: <rotated>`) from
`_01_rsc_wpm_backend/docker-compose.yml`, switch to Docker Compose native `secrets:` file mounts
(secrets mounted read-only at `/run/secrets/`, only file paths visible to `docker inspect` /
`ps e` / `docker compose config`), rotate the exposed `<rotated>` credential, and keep secrets out of
Git and operational command output. Follows `SECURE_SECRETS_PLAN.md`.

## Scope

- In: backend `docker-compose.yml`, backend `postgres.ts`, backend `.gitignore`, new
  `_01_rsc_wpm_backend/secrets/` (gitignored, with committed `.gitkeep`), README documentation.
- Out: Mozilla SOPS, Vault, CI secret scanning, Git history rewrite (requires separate
  authorization), production secret managers, frontend credentials.
- The running `postgres_data` volume was initialized with `<rotated>`; rotating requires a fresh
  volume (destructive) before the stack can start end-to-end with the new password.

## Checklist

- [x] FTD document written before the change
- [x] `secrets/db_user.txt` and `secrets/db_password.txt` created, gitignored, new strong password
- [x] `secrets/.gitkeep` committed with setup instructions
- [x] `secrets/` added to `_01_rsc_wpm_backend/.gitignore`
- [x] `docker-compose.yml` uses `secrets:` block; no inline credential literals remain
- [x] `postgres.ts` reads `DB_USER_FILE`/`DB_PASSWORD_FILE` with env fallback
- [x] README documents the new secrets setup and removed inline creds
- [x] `docker compose config` shows only file paths, no password values
- [x] `tsc --noEmit` in backend reports zero errors (2 pre-existing in dead `src/main.ts`, unrelated)
- [x] Stack restarts cleanly and `/health` returns 200 with rotated password (volume recreated by
      explicit user decision: "Recrear sin backup")

## Evidence

- `secrets/db_user.txt` (5 bytes) and `secrets/db_password.txt` (45 bytes, `openssl rand -base64 32`, never printed) created; `git check-ignore` confirms both ignored via `.gitignore:26 secrets/`.
- `docker compose config` resolves `DB_USER_FILE`/`DB_PASSWORD_FILE`/`POSTGRES_*_FILE` to `/run/secrets/...` and top-level `secrets:` show only `file:` paths — no password value anywhere in output.
- `grep <rotated>` across `_01_rsc_wpm_backend` (compose, src, .gitignore): no matches. Remaining `<rotated>` occurrences are documentation references, the gitignored root `.env` (updated to the new value) and `project-tools/db-healthcheck.sh` (separate TODO item).
- `docker compose down` + volume recreate + `up -d --build`: postgres healthy, backend started.
- `docker inspect 01_rsc_wpm_bun_psgres-backend` env: only `DB_USER_FILE=/run/secrets/db_user` and `DB_PASSWORD_FILE=/run/secrets/db_password` — no password value.
- `docker exec backend ls /run/secrets/`: `db_password` (45) and `db_user` (5) mounted.
- `curl http://localhost:4001/health` → `{"status":"ok"}` HTTP 200.
- `./project-tools/container-management.sh test-backend --container`: 5 unit + 11 API = **16/16 pass**.
- `./project-tools/container-management.sh test-frontend`: **11/11 pass**.
- `tsc --noEmit`: zero errors from this change; 2 pre-existing remain in dead `src/main.ts` (TODO item "Delete dead backend file").
- Root `.env` (gitignored) updated to the rotated password so local non-Docker runs stay coherent.

## Follow-up scrub (2026-10-07)

- Replaced `admin123` → `<rotated>` in tracked docs: `.github/issue_env_secrets.md`,
  `FEATURE_PLAN_db-healthcheck.md`, `LEARNINGS/new-projects-structure-n-secure-bests-practices.md`,
  `SECURE_SECRETS_PLAN.md`, `TODO.md`, this doc; rephrased README without the literal.
- **Finding**: root `.env` was TRACKED despite the `.gitignore` — the line `.env .env.local
  .env.production` was one space-joined pattern, which gitignore does not split (one pattern per
  line required). Fixed `.gitignore` and untracked `.env` (`git rm --cached`), so the rotated
  password stays out of Git.
- Remaining tracked literal: `project-tools/db-healthcheck.sh` only — separate TODO item
  (credential hardening); intentionally untouched.

## Next

Commit the change on `feat/dev-compose-secrets-file-mounts` (user decision; not auto-committed).
Follow-ups owned by other TODO items: `db-healthcheck.sh` hardcoded creds, history rewrite
(requires authorization), CI secret scanning.