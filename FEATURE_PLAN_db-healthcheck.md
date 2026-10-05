# Feature Plan: Database Health Check Script

## Overview

An independent Bash script in `project-tools/` that verifies the PostgreSQL
container, database, schema, constraints, and data. Supports a full health check
suite, single-check filtering, and ad-hoc SQL query execution.

## Script

**Path:** `project-tools/db-healthcheck.sh`

**Dependencies:** Docker, `docker compose` (fallback `docker-compose` v1), `psql` (inside the postgres container)

## Verified Facts (do not re-assume — check these against reality)

These were confirmed against the running stack and are the source of truth for
this plan. If any of them stop holding, update this section first.

| Fact | Value | How it was verified |
|---|---|---|
| Compose file | `_01_rsc_wpm_backend/docker-compose.yml` | **There is no compose file at the repo root** |
| Compose service name | `postgres` | `docker-compose.yml` services |
| Resolved container name | `01_rsc_wpm_backend-postgres-1` | `docker ps` |
| Database / user / password | `wpm_db` / `admin` / `admin123` | `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` |
| Postgres image | `postgres:16-alpine` | `docker-compose.yml` |
| Schema source | `_01_rsc_wpm_backend/db/init/01-schema.sql` | Mounted at `/docker-entrypoint-initdb.d/01-schema.sql` |
| Actual table shape | `id SERIAL PK`, `nombre VARCHAR(100) NOT NULL`, `email VARCHAR(100) UNIQUE NOT NULL` | Read the schema file |
| Row count in dev | 39 | `SELECT count(*) FROM usuario` |
| **No seed script exists** | only `01-schema.sql` | `find` for seed/insert files returned nothing |

### Critical: NOT NULL is not in `pg_constraint` (PG 16)

Verified by running the query — it returns exactly two rows:

```
usuario_pkey      | p | PRIMARY KEY (id)
usuario_email_key | u | UNIQUE (email)
```

NOT NULL constraints are **absent** from `pg_constraint` in PostgreSQL 16. They
live in `pg_attribute.attnotnull` and surface as `is_nullable = 'NO'` in
`information_schema.columns`. Any check that looks for NOT NULL in
`pg_constraint` will always fail. Constraint and column-nullability checks must
use two different catalogs.

### Fragility note: a fresh clone has zero rows

`count(*) > 0` must **not** be a hard pass criterion. The volume `postgres_data`
is only seeded when the DB was first created, and no seed script is committed.
A teammate's fresh clone would report a false failure. Report the count and
warn; do not fail.

## Usage

```bash
# Run full health check suite (default)
./project-tools/db-healthcheck.sh

# Run a single SQL query
./project-tools/db-healthcheck.sh -q "SELECT * FROM usuario LIMIT 5"

# Run multiple SQL queries
./project-tools/db-healthcheck.sh -q "SELECT count(*) FROM usuario" -q "SELECT * FROM usuario LIMIT 3"

# Run queries from a file (one query per line, # comments allowed)
./project-tools/db-healthcheck.sh --file queries.sql

# Run only specific checks
./project-tools/db-healthcheck.sh --check container,pg_ready

# Disable color output (auto-detected when piping; flag forces it off)
./project-tools/db-healthcheck.sh --no-color

./project-tools/db-healthcheck.sh --help
```

## CLI Options

| Option | Description |
|---|---|
| *(no args)* | Run the full health check suite |
| `-q "SQL"` / `--query "SQL"` | Execute one or more SQL queries, print results as a table |
| `--file <path>` | Execute queries from a file (one per line, `#` comments ignored) |
| `--check <list>` | Run only the named checks (comma-separated) |
| `--no-color` | Disable ANSI color |
| `-h` / `--help` | Show usage and exit |

Modes are mutually exclusive: `-q`/`--file` skip the suite, and cannot be
combined with each other or with `--check`.

## Configuration

Read from the environment with dev defaults, so the script works with zero setup
but can be overridden without editing it.

| Variable | Default | Purpose |
|---|---|---|
| `DB_USER` | `admin` | Postgres role |
| `DB_PASS` | `admin123` | Password (used only if the role needs it) |
| `DB_NAME` | `wpm_db` | Database |
| `DB_SERVICE` | `postgres` | Compose service name |
| `DB_SCHEMA` | `public` | Schema holding the table |
| `DB_TABLE` | `usuario` | Table under test |
| `COMPOSE_FILE` | `$REPO_ROOT/_01_rsc_wpm_backend/docker-compose.yml` | Compose file |

No secret is hardcoded beyond the dev default already committed in
`docker-compose.yml`; the values are overridable, not embedded in the script.

## Health Check Suite (Default Mode)

| # | Check | Catalog / method | Pass criteria |
|---|---|---|---|
| 1 | Container running | `docker compose ps --filter name=$DB_SERVICE --format '{{.Status}}'` | Output contains `Up` |
| 2 | Container healthy | `docker inspect` → `.State.Health.Status` | `healthy` (compose already defines a `pg_isready` healthcheck) |
| 3 | Accepting connections | `pg_isready -U $DB_USER -d $DB_NAME` | Exit code 0 |
| 4 | Database exists and sized | `SELECT pg_size_pretty(pg_database_size('$DB_NAME'))` | Query succeeds, returns non-null |
| 5 | Table exists | `SELECT to_regclass('$DB_SCHEMA.$DB_TABLE')` | Not null |
| 6 | Required columns present | `information_schema.columns` | `id`/`integer`, `nombre`/`character varying`(100), `email`/`character varying`(100) all present |
| 7 | Constraints present | `pg_constraint` **and** `information_schema.columns.is_nullable` | PK on `id` + UNIQUE on `email` (from `pg_constraint`); `nombre` and `email` both `is_nullable = 'NO'` |
| 8 | Data readable | `SELECT count(*) FROM $DB_TABLE` | Query succeeds; prints the count, and **warns** (does not fail) when 0 |

### Resilient check strategy

Schema and constraint checks assert that **required elements are present**, never
an exact count. Adding a column, index, or constraint later must not turn the
health check red — a health check that cries wolf gets muted, and then it is
useless. Extra elements are always allowed.

### Catalog split for check 7

| Element | Correct source | Wrong source |
|---|---|---|
| Primary key on `id` | `pg_constraint` (`contype = 'p'`) | — |
| Unique on `email` | `pg_constraint` (`contype = 'u'`) | — |
| NOT NULL on `nombre`/`email` | `information_schema.columns.is_nullable` or `pg_attribute.attnotnull` | `pg_constraint` — **returns nothing in PG 16** |

## Custom Query Mode (`-q` / `--file`)

- Each query runs through `docker compose -f "$COMPOSE_FILE" exec -T $DB_SERVICE psql -U $DB_USER -d $DB_NAME -c "<query>"`
- Results print in psql's default table format
- Queries run sequentially, each echoed first with a `>>>` prefix
- Exit 0 if all succeed, exit 1 on the first failure
- `--file` reads one query per line, skips blanks and `#` comments, and on
  failure reports the line number so the offending query can be found

## Output Format

- `PASS`/`FAIL` per check in green/red, matching the `RED`/`GREEN`/`NC`
  variables already used by `container-management.sh`
- Colors auto-disable when stdout is not a TTY; `--no-color` forces it off
- Summary line: `8/8 checks passed`, or `6/8 checks passed` plus a warning count
- Exit 0 when everything passes, exit 1 on any failure

## Design Decisions

| Decision | Why | Alternative rejected |
|---|---|---|
| Exec `psql` inside the container | No host `psql` dependency; guarantees the same client/server versions | Host `psql`, which needs an install and can version-skew |
| Credentials from env with dev defaults | Zero-setup locally, overridable in CI, no secrets new in the script | Hardcoded values — no override path, poor CI story |
| Required-not-exact assertions | Survives schema migrations; a noisy check gets ignored | Exact counts — breaks on every migration |
| Two catalogs for constraints | `pg_constraint` cannot express NOT NULL in PG 16 | One catalog — silently wrong |
| `count(*)` reported, zero warned not failed | No committed seed script; a fresh clone has zero rows | `count > 0` as a criterion — false failure on a fresh clone |
| `timeout` on every docker/psql call | An unresponsive DB must not hang the tool forever | No timeout — CI jobs hang until the global timeout |
| Separate `--check` filter | Fast single-signal runs while debugging | Always run all checks — slower, noisier |
| Purely additive | No existing script's behavior changes | Folding into `container-management.sh` — larger blast radius |

## Files Touched

- **Create:** `project-tools/db-healthcheck.sh` (new, ~220 lines)

Nothing else is modified. `container-management.sh`, the compose files, and the
schema are read-only inputs.

## Implementation Tasks

- [ ] **Task 1: Script skeleton and configuration**
  - Shebang, `set -euo pipefail`, `REPO_ROOT` via `cd "$(dirname "$0")/.." && pwd`
    (same idiom as `container-management.sh`)
  - `RED`/`GREEN`/`YELLOW`/`NC` colors; auto-disable when `[[ ! -t 1 ]]`, plus a
    `--no-color` override
  - Env-var config block with the defaults in the table above
  - `COMPOSE_CMD` resolution: prefer `docker compose`, fall back to `docker-compose`
  - Preflight: fail fast with a clear message if Docker or the compose file is missing
  - `usage()` plus the argument loop (`-q`, `--query`, `--file`, `--check`, `--no-color`, `--help`)

- [ ] **Task 2: Health check functions**
  - `check_container_running()` — `ps --filter name=$DB_SERVICE`, and guard the
    call so a non-zero exit does not trip `set -e`; the repo already uses
    `... 2>/dev/null || { echo ...; return 1; }` for this
  - `check_container_healthy()` — `docker inspect` the resolved container name
    and read `.State.Health.Status`
  - `check_pg_ready()` — `pg_isready` inside the container, wrapped in `timeout`
  - `check_database_size()` — `pg_database_size`, wrapped in `timeout`
  - `check_table_exists()` — `to_regclass`
  - `check_schema()` — assert each required column and type from
    `information_schema.columns`, including `character_maximum_length = 100`
  - `check_constraints()` — PK/UNIQUE from `pg_constraint`; NOT NULL from
    `is_nullable` (see the catalog split above — do not merge these)
  - `check_data_readable()` — print the row count; warn without failing when 0

- [ ] **Task 3: Query mode**
  - `run_query()` — one SQL string via `psql -c`, wrapped in `timeout`
  - `run_query_file()` — line-numbered read, skipping blanks and `#` comments,
    reporting the failing line number
  - Support repeated `-q` flags, executed in order

- [ ] **Task 4: Runner, filtering, and exit codes**
  - `run_check()` — timing, PASS/FAIL, color, pass/fail tallies
  - `--check` filter over a `name -> function` registry
  - Summary line; exit 0 on full pass, 1 on any failure

- [ ] **Task 5: Test the script**
  - Stack up: `./project-tools/container-management.sh start-all`
  - Full suite — expect 8/8 against the running dev database
  - `--check container,pg_ready` — expect exactly 2 checks to run
  - `-q "SELECT * FROM usuario LIMIT 3"` — expect a table
  - `--file` with several queries — expect sequential execution
  - `--file` with one bad query — expect the line number in the failure
  - Stack down — expect a clean FAIL on check 1, not a crash or a hang
  - Invalid SQL — expect a clear psql error and exit 1
  - `--no-color`, and piped output — expect no ANSI escapes in either case

## Not Included (Future Work)

- `--json` output for CI consumption
- Folding a `db-health` action into `container-management.sh`
- Per-query timeout and row-limit flags
- Multiple databases or schemas beyond the single configured target
- Moving credentials to a secrets manager (tracked separately in
  `SECURE_SECRETS_PLAN.md`)
