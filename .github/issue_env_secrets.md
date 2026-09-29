# ENV Variables with secrets and database name committed to public repo

## Problem
- `docker-compose.yml` commits `POSTGRES_PASSWORD: admin123`, `DB_PASSWORD: admin123`, `POSTGRES_DB: wpm_db`, `DB_NAME: wpm_db`
- Repo `mikelemus27/rsc-web-picture-market` is public
- Secrets (passwords) and DB identifier exposed in Git history

## Required action
- Move secrets to `.env` (not committed) and load via `env_file` / `env_file` in compose
- Remove hardcoded credentials from `docker-compose.yml` and rotate them
- Verify `.gitignore` excludes `.env`
- Audit prior commits (`b2767c9`, `d6e47b7`) for secret leakage
