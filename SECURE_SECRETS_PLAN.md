# Secure Secrets Implementation Plan

## Goal

Remove inline credentials from `docker-compose.yml`, use Docker Compose native
secrets (file mounts), rotate the exposed `<rotated>` credential, and keep
secrets out of Git history and `docker inspect` output.

## Current state

| Item | Location | Status |
|---|---|---|
| `POSTGRES_PASSWORD: <rotated>` | `_01_rsc_wpm_backend/docker-compose.yml:13` | Inline, committed |
| `DB_PASSWORD: <rotated>` | `_01_rsc_wpm_backend/docker-compose.yml:46` | Inline, committed |
| `.env` in `.gitignore` | Root + backend + frontend | Already covered |
| `<rotated>` in Git history | Multiple commits | Exposed, needs rotation |
| Backend reads password | `src/infraestructura/database/postgres.ts` | `process.env.DB_PASSWORD` |

## Approach: Docker Compose secrets with file mounts

Use the `secrets:` block with `file:` — the native Docker mechanism that
mounts secrets as **read-only files** at `/run/secrets/` inside the container.
Secrets never appear in `docker inspect`, `ps e`, or `docker compose config`.

### Why not `env_file: .env`?

| Mechanism | `docker inspect` | `ps e` | Compose config |
|---|---|---|---|
| `env_file: .env` | Password visible | Password visible | Password visible |
| `secrets: file: ...` | Only file path | Not shown | Only file path |

`env_file` is acceptable for dev when `.env` is gitignored, but `secrets:` is
strictly better — it protects against accidental exposure via operational
commands, which is the most common way secrets leak.

## Architecture

```
_01_rsc_wpm_backend/
├── secrets/                        # NEW — gitignored
│   ├── db_user.txt                 # Contains: admin
│   └── db_password.txt             # Contains: <new-strong-password>
├── docker-compose.yml              # MODIFIED — uses secrets: block
├── src/infraestructura/database/postgres.ts  # MODIFIED — reads DB_PASSWORD_FILE
└── ...
```

## Implementation steps

### Step 1: Create secret files

Create `_01_rsc_wpm_backend/secrets/` with two files:

- `db_user.txt` — contains `admin`
- `db_password.txt` — contains a new strong password (not `<rotated>`)

Generate a strong password:
```bash
openssl rand -base64 32
```

### Step 2: Add `secrets/` to `.gitignore`

Add to `_01_rsc_wpm_backend/.gitignore`:
```
secrets/
```

### Step 3: Modify `docker-compose.yml`

Replace inline credentials with the `secrets:` block:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: always
    environment:
      POSTGRES_USER_FILE: /run/secrets/db_user
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
      POSTGRES_DB: wpm_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./db/init/01-schema.sql:/docker-entrypoint-initdb.d/01-schema.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U admin -d wpm_db"]
      interval: 5s
      timeout: 5s
      retries: 12
      start_period: 5s
    networks:
      - rsc-network
    secrets:
      - db_user
      - db_password

  backend:
    build: .
    container_name: 01_rsc_wpm_bun_psgres-backend
    restart: unless-stopped
    ports:
      - "4001:4001"
    environment:
      DB_HOST: postgres
      DB_NAME: wpm_db
      DB_PORT: 5432
      DB_USER_FILE: /run/secrets/db_user
      DB_PASSWORD_FILE: /run/secrets/db_password
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - rsc-network
    secrets:
      - db_user
      - db_password

secrets:
  db_user:
    file: ./secrets/db_user.txt
  db_password:
    file: ./secrets/db_password.txt

volumes:
  postgres_data:

networks:
  rsc-network:
    driver: bridge
```

Key changes:
- `POSTGRES_PASSWORD` → `POSTGRES_PASSWORD_FILE` (postgres image supports `_FILE` natively)
- `POSTGRES_USER` → `POSTGRES_USER_FILE`
- `DB_PASSWORD` → `DB_PASSWORD_FILE` (app reads from file)
- `DB_USER` → `DB_USER_FILE`
- Top-level `secrets:` block defines the file-based secrets
- Both services mount the secrets they need

### Step 4: Modify `postgres.ts` to read secret files

Change `_01_rsc_wpm_backend/src/infraestructura/database/postgres.ts`:

```ts
import { Pool } from "pg";
import { readFileSync } from "fs";

function readSecretFile(path: string | undefined, fallback: string): string {
  if (!path) return fallback;
  try {
    return readFileSync(path, "utf-8").trim();
  } catch {
    return fallback;
  }
}

const dbPassword = readSecretFile(process.env.DB_PASSWORD_FILE, process.env.DB_PASSWORD || "");
const dbUser = readSecretFile(process.env.DB_USER_FILE, process.env.DB_USER || "admin");

export const db = new Pool({
  host: process.env.DB_HOST || "postgres",
  port: Number(process.env.DB_PORT) || 5432,
  user: dbUser,
  password: dbPassword,
  database: process.env.DB_NAME || "wpm_db",
});
```

This approach:
- Reads the secret from the file mounted at `/run/secrets/db_password`
- Falls back to env var if file not present (for local dev without Docker)
- The password never becomes an env var — it stays a file end-to-end

### Step 5: Create `secrets/.gitkeep` with instructions

Create `_01_rsc_wpm_backend/secrets/.gitkeep`:

```
This directory holds secret files for Docker Compose.

Create the following files here (never commit them):
  db_user.txt       — PostgreSQL username
  db_password.txt   — PostgreSQL password

Generate a strong password with: openssl rand -base64 32

These files are loaded by docker-compose.yml via the secrets: block.
```

### Step 6: Rotate the exposed credential

The `<rotated>` password has been committed to Git history. Steps:

1. Generate a new strong password (Step 1)
2. Put it in `secrets/db_password.txt`
3. Start the stack with the new password — PostgreSQL will initialize with it
4. The old `<rotated>` in Git history should be considered compromised
5. If this repo is ever pushed to a remote, rewrite history with `git-filter-repo`
   (separate, careful operation — requires authorization)

### Step 7: Update documentation

Update `README.md` to document:
- The new `secrets/` directory and how to populate it
- That credentials are no longer inline in `docker-compose.yml`
- The `_FILE` env var pattern used by the app

### Step 8: Test

```bash
# Start the stack
./project-tools/container-management.sh start-all

# Verify secrets are mounted as files (not env vars)
docker compose -f _01_rsc_wpm_backend/docker-compose.yml exec backend ls -la /run/secrets/
docker compose -f _01_rsc_wpm_backend/docker-compose.yml exec backend cat /run/secrets/db_password

# Verify docker inspect does NOT show the password
docker inspect 01_rsc_wpm_bun_psgres-backend | grep -i password
# Should only show DB_PASSWORD_FILE=/run/secrets/db_password, not the value

# Verify the backend connects to PostgreSQL
curl http://localhost:4001/health
# Should return {"status":"ok"}

# Run tests
./project-tools/container-management.sh test-backend --container
./project-tools/container-management.sh test-frontend
```

## Security benefits

| Before | After |
|---|---|
| `<rotated>` visible in `docker-compose.yml` | Secret in gitignored file |
| `<rotated>` visible in `docker inspect` | Only file path shown |
| `<rotated>` visible in `ps e` | Not shown |
| `<rotated>` visible in `docker compose config` | Only file path shown |
| `<rotated>` in Git history | New credential rotated |
| No file permissions on secrets | Secrets mounted read-only |

## Files touched

| File | Action |
|---|---|
| `_01_rsc_wpm_backend/secrets/db_user.txt` | Create (gitignored) |
| `_01_rsc_wpm_backend/secrets/db_password.txt` | Create (gitignored) |
| `_01_rsc_wpm_backend/secrets/.gitkeep` | Create (committed) |
| `_01_rsc_wpm_backend/.gitignore` | Add `secrets/` |
| `_01_rsc_wpm_backend/docker-compose.yml` | Replace inline creds with `secrets:` block |
| `_01_rsc_wpm_backend/src/infraestructura/database/postgres.ts` | Read `DB_PASSWORD_FILE` / `DB_USER_FILE` |
| `README.md` | Document the new secrets setup |

## Not included (future work)

- **Mozilla SOPS** — encrypted secrets in the repo (stronger, adds tooling)
- **HashiCorp Vault sidecar** — production-grade secret management
- **CI secret scanning** (`ggshield` or `trufflehog`) — catch future leaks
- **Git history rewrite** — separate operation, requires authorization
- **Production secrets manager** — AWS Secrets Manager, Azure Key Vault, etc.
