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
| Database / user / password | `wpm_db` / `admin` / `<rotated>` | `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` |
| Postgres image | `postgres:16-alpine` | `docker-compose.yml` |
| Schema source | `_01_rsc_wpm_backend/db/init/01-schema.sql` | Mounted at `/docker-entrypoint-initdb.d/01-schema.sql` |
| Actual table shape | `id SERIAL PK`, `nombre VARCHAR(100) NOT NULL`, `email VARCHAR(100) UNIQUE NOT NULL` | Read the schema file |
| Row count in dev | 39 | `SELECT count(*) FROM usuario` |
| **No seed script exists** | only `01-schema.sql` | `find` for seed/insert files returned nothing |
| **`compose ps --filter name=` is rejected** | use a positional service name instead | returns `unknown filter name`, exit 1 |
| **Shebang must be bash** | `set -o pipefail` is not POSIX | fails under `dash` |

### Critical: `docker compose ps --filter name=<svc>` does not work here

Verified against this machine's compose version:

```
$ docker compose -f _01_rsc_wpm_backend/docker-compose.yml ps --filter name=postgres --format '{{.Status}}'
unknown filter name            # exit 1

$ docker compose -f _01_rsc_wpm_backend/docker-compose.yml ps postgres --format '{{.Status}}'
Up 34 hours (healthy)          # correct
```

The service must be passed **positionally**. Two consequences:

1. This script uses the positional form. It also surfaces the real `docker
   compose ps` error instead of `|| true`-swallowing it, because a swallowed
   error is indistinguishable from "container absent" and reports the wrong
   cause.
2. **`container-management.sh` has this same latent bug.** Its
   `check_backend_running()` and `check_frontend_network()` both use
   `--filter name=backend`, which exits 1 on this compose version — so they
   report "Backend not running" even while the backend is up. Not fixed here,
   because this feature is independent of that script. Worth a separate issue.

### Critical: `docker compose exec` drains stdin

`docker compose exec` inherits this process's stdin. Called from a
`while read` loop over a query file, it consumes the file being read and the
loop silently stops after the first query — with no error. Every `exec` call in
this script therefore redirects `</dev/null`.

### Shebang is bash, not sh

`container-management.sh` uses `#!/usr/bin/env sh` and avoids `set -e`
entirely. This script is specified with `set -euo pipefail`, and `pipefail` is
not POSIX, so re-heading it to `sh` would break it under `dash`.

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
| `DB_PASS` | `<rotated>` | Password (used only if the role needs it) |
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
| 1 | Container running | `docker compose ps <service> --format '{{.Status}}'` (positional, not `--filter name=`) | Output contains `Up` |
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

- [x] **Task 1: Script skeleton and configuration**
  - Shebang `#!/usr/bin/env bash` (not `sh` — see Verified Facts), `set -euo pipefail`,
    `REPO_ROOT` via `cd "$(dirname "$0")/.." && pwd`
  - `RED`/`GREEN`/`YELLOW`/`NC` colors; auto-disable when stdout is not a TTY, plus a
    `--no-color` override
  - Env-var config block with the defaults in the table above
  - `COMPOSE_CMD` resolution: prefer `docker compose`, fall back to `docker-compose`
  - Preflight: fail fast with a clear message if Docker or the compose file is missing
  - `usage()` plus the argument loop (`-q`, `--query`, `--file`, `--check`, `--no-color`, `--help`)

- [x] **Task 2: Health check functions**
  - `check_container_running()` — positional service form, surfacing the real compose
    error instead of swallowing it
  - `check_container_healthy()` — `docker inspect` the container ID from
    `compose ps -q` and read `.State.Health.Status`
  - `check_pg_ready()` — `pg_isready` inside the container, wrapped in `timeout`
  - `check_database_size()` — `pg_database_size`, wrapped in `timeout`
  - `check_table_exists()` — `to_regclass`
  - `check_schema()` — assert each required column and type from
    `information_schema.columns`, including `character_maximum_length = 100`
  - `check_constraints()` — PK/UNIQUE from `pg_constraint`; NOT NULL from
    `is_nullable` (see the catalog split above — do not merge these)
  - `check_data_readable()` — print the row count; warn without failing when 0

- [x] **Task 3: Query mode**
  - `run_query()` — one SQL string via `psql -c`, wrapped in `timeout`, stdin
    detached with `</dev/null`
  - `run_query_file()` — line-numbered read, skipping blanks and `#` comments,
    reporting the failing line number
  - Support repeated `-q` flags, executed in order

- [x] **Task 4: Runner, filtering, and exit codes**
  - `run_check()` — timing, PASS/FAIL, color, pass/fail tallies
  - `--check` filter validated against the registry, rejecting unknown names
  - Summary line; exit 0 on full pass, 1 on any failure

- [x] **Task 5: Test the script** — all verified against the running stack

| Scenario | Expected | Result |
|---|---|---|
| Full suite | 8/8, exit 0 | 8/8, exit 0 |
| `--check container,pg_ready` | exactly 2 checks | 2/2, exit 0 |
| `-q "SELECT * FROM usuario LIMIT 3"` | table | 3-row table, exit 0 |
| Two `-q` flags | both run in order | both ran |
| `--file` with comments + blanks | comments/blanks skipped, both queries run | ran lines 2 and 4 |
| `--file` with a bad query | failing line number, exit 1 | `Query failed at line 2`, exit 1 |
| Invalid SQL via `-q` | clear psql error, exit 1 | error shown, exit 1 |
| `--check` + `-q` together | rejected | error, exit 1 |
| Unknown check name | rejected with the valid list | error listed all 8 names |
| Missing compose file | rejected with override hint | error, exit 1 |
| Container absent (`DB_SERVICE=ghost`) | clean FAILs, no crash or hang | 0/8, real error surfaced |
| Queries with container absent | actionable message, exit 1 | error, exit 1 |
| `--no-color` under a TTY | no ANSI codes | 0 codes |
| Piped output | no ANSI codes | 0 codes |
| Default under a TTY | ANSI codes present | present |
| Empty table | PASS + WARN, **exit 0** | `1/1 checks passed, 1 warning(s)` |
| Required cols + extra cols | PASS | PASS |
| Required col missing | FAIL | `Unusable columns: email(absent)` |
| Wrong varchar length | FAIL | `got character varying\|50, want ...\|100` |
| NOT NULL absent, PK+UNIQUE present | FAIL | `NOT-NULL-nombre NOT-NULL-email` |
| Full constraint set | PASS | PASS |
| Extra index + CHECK constraint added | PASS (drift-tolerant) | PASS |

Drift cases were exercised against a scratch table (`zz_healthcheck_probe`),
created and dropped inside the same command so cleanup always ran. `usuario` was
never modified. The "container absent" cases were exercised with
`DB_SERVICE=ghost` rather than stopping the running stack.

## Not Included (Future Work)

- `--json` output for CI consumption
- Folding a `db-health` action into `container-management.sh`
- Per-query timeout and row-limit flags
- Multiple databases or schemas beyond the single configured target
- Moving credentials to a secrets manager (tracked separately in
  `SECURE_SECRETS_PLAN.md`)
