# Feature Plan: Database Health Check Script

## Overview

An independent Bash script in `project-tools/` that verifies the PostgreSQL
container, database, schema, and data. Supports a full health check suite and
ad-hoc SQL query execution.

## Script

**Path:** `project-tools/db-healthcheck.sh`

**Dependencies:** Docker, `docker compose`, `psql` (inside the postgres container)

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

# Show help
./project-tools/db-healthcheck.sh --help
```

## CLI Options

| Option | Description |
|---|---|
| *(no args)* | Run full health check suite (7 checks) |
| `-q "SQL"` / `--query "SQL"` | Execute one or more SQL queries and display results as a table |
| `--file <path>` | Execute all queries from a file (one per line, `#` comments ignored) |
| `-h` / `--help` | Show usage and exit |

## Health Check Suite (Default Mode)

| # | Check | Method | Pass Criteria |
|---|---|---|---|
| 1 | Container running | `docker compose ... ps postgres` | Status contains `Up` |
| 2 | PostgreSQL accepting connections | `pg_isready -U admin -d wpm_db` | Exit code 0 |
| 3 | Database exists | `SELECT 1 FROM pg_database WHERE datname = 'wpm_db'` | Row returned |
| 4 | Table exists | `SELECT to_regclass('public.usuario')` | Not null |
| 5 | Schema correct | Query `information_schema.columns` for `usuario` | 3 columns with correct types |
| 6 | Constraints present | Query `pg_constraint` for `usuario` | PK on `id`, UNIQUE on `email`, NOT NULL on `nombre`/`email` |
| 7 | Data readable | `SELECT count(*) FROM usuario` | Query succeeds |

## Custom Query Mode (`-q` / `--file`)

- Each query runs via `docker compose ... exec -T postgres psql -U admin -d wpm_db -c "<query>"`
- Results displayed in psql's default table format
- Queries run sequentially; each is echoed before execution with a `>>>` prefix
- Exit 0 if all queries succeed, exit 1 if any fail
- `--file` reads one query per line, skips blank lines and `#` comments

## Output Format

- Color-coded `PASS`/`FAIL` per check (green/red), matching `container-management.sh` style
- Summary line at the end: `7/7 checks passed` or `5/7 checks passed`
- Exit 0 on full success, exit 1 on any failure

## Key Design Decisions

- Uses `docker compose -f ... exec -T postgres psql` — runs inside the container, no host `psql` needed
- Credentials hardcoded for dev (`admin`/`admin123`), with a note to externalize later
- Query mode and health-check mode are mutually exclusive — providing `-q` or `--file` skips the health suite
- No modifications to existing files — purely additive

## Files Touched

- **Create:** `project-tools/db-healthcheck.sh` (new, ~150 lines)

## Implementation Tasks

- [ ] **Task 1: Create script skeleton**
  - Create `project-tools/db-healthcheck.sh` with shebang, `set -euo pipefail`, color variables, and `REPO_ROOT` resolution
  - Add `usage()` function with help text
  - Add argument parsing loop (`-q`, `--query`, `--file`, `--help`)

- [ ] **Task 2: Implement health check functions**
  - `check_container_running()` — verify postgres container is `Up`
  - `check_pg_ready()` — run `pg_isready` inside container
  - `check_database_exists()` — query `pg_database`
  - `check_table_exists()` — query `to_regclass`
  - `check_schema()` — verify columns and types via `information_schema.columns`
  - `check_constraints()` — verify PK, UNIQUE, NOT NULL via `pg_constraint`
  - `check_data_readable()` — run `SELECT count(*) FROM usuario`

- [ ] **Task 3: Implement query execution mode**
  - `run_query()` — execute a single SQL string via `psql -c` and display results
  - `run_query_file()` — read file line-by-line, skip blanks/comments, execute each
  - Handle multiple `-q` flags sequentially

- [ ] **Task 4: Implement output and exit code logic**
  - `run_check()` wrapper — timing, PASS/FAIL tracking, color output
  - Summary line with passed/total count
  - Exit 0 on full success, exit 1 on any failure

- [ ] **Task 5: Test the script**
  - Start the stack: `./project-tools/container-management.sh start-all`
  - Run health check suite — verify all 7 checks pass
  - Run with `-q "SELECT * FROM usuario"` — verify table output
  - Run with `--file` containing multiple queries — verify sequential execution
  - Run with no containers started — verify graceful failure
  - Run with invalid SQL — verify error handling and exit 1

## Not Included (Future Work)

- `--json` output mode for CI integration
- Configurable credentials via env vars (blocked on credential externalization TODO)
- Integration into `container-management.sh` as a `db-health` action
- Query timeout / row limit flags
- Support for multiple databases or schemas beyond `wpm_db`
