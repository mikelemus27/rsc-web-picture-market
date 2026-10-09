#!/usr/bin/env bash
# Project-tools: PostgreSQL health check and ad-hoc query runner
# Author: miguel.gallardo.lemus@gmail.com
# Usage: ./project-tools/db-healthcheck.sh [--check <list> | -q <sql> | --file <path> | --db-name | --tables | --columns <table>]
#
# Independent tool. It reads container-management.sh and the compose files but
# never modifies them, and it is not wired into them.
#
# Requires bash: `set -o pipefail` is not available under POSIX sh (dash), so
# this script must not be re-headed to `#!/usr/bin/env sh`.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# ---------------------------------------------------------------------------
# Configuration. Every value can be overridden from the environment so CI does
# not have to edit this file. The defaults mirror docker-compose.yml.
# ---------------------------------------------------------------------------
# No plaintext credential defaults: DB_PASS is resolved at preflight from the
# environment or from the backend secrets files (single source of truth).
DB_USER="${DB_USER:-}"
DB_PASS=""
DB_NAME="${DB_NAME:-wpm_db}"
DB_SERVICE="${DB_SERVICE:-postgres}"
DB_SCHEMA="${DB_SCHEMA:-public}"
DB_TABLE="${DB_TABLE:-usuario}"
COMPOSE_FILE="${COMPOSE_FILE:-$REPO_ROOT/_01_rsc_wpm_backend/docker-compose.yml}"

TIMEOUT_SECS="${TIMEOUT_SECS:-10}"

# Declared up front so fail() can print before setup_colors has run; set -u
# would abort on an unbound reference.
RED='' GREEN='' YELLOW='' NC=''

# A check signals a non-fatal warning by emitting a line prefixed with this
# sentinel. Checks run inside a command substitution, so a variable increment
# would happen in a subshell and be lost; output is the only channel back.
WARN_SENTINEL='__WARN__'

# Columns the application depends on: name:type:max_length. Asserted by
# presence, never by count, so adding a column later does not break the check.
REQUIRED_COLUMNS=("id:integer:" "nombre:character varying:100" "email:character varying:100")
# NOT NULL must be read from information_schema, not pg_constraint. See below.
REQUIRED_NOT_NULL=("nombre" "email")

COMPOSE_CMD=""

usage() {
  cat <<EOF
Usage: $0 [options]

With no options, runs the full health check suite.

Options:
  -q, --query <sql>    Run one SQL query and print the result. Repeatable.
      --file <path>    Run every query in a file, one per line (# comments
                       and blank lines are skipped).
      --check <list>   Run only the named checks, comma-separated.
      --db-name        Print the connected database name (one raw line).
      --tables         List base tables in DB_SCHEMA (one per line).
      --columns <tab>  List a table's columns as name|type|max_len|nullable.
      --no-color       Disable ANSI color (also automatic when not a TTY).
  -h, --help           Show this help.

Checks available to --check:
  container     The Postgres container is running
  health        The container's Docker healthcheck reports healthy
  pg_ready      pg_isready accepts connections
  db_size       The database exists and reports a size
  table         The target table exists
  schema        Required columns exist with the expected types
  constraints   PK, UNIQUE and NOT NULL are present
  data          The table can be read; prints the row count

Modes are mutually exclusive: --check, -q, --file, --db-name, --tables and
--columns cannot be combined.

Environment overrides:
  DB_USER DB_PASS PGPASSWORD DB_NAME DB_SERVICE DB_SCHEMA DB_TABLE COMPOSE_FILE TIMEOUT_SECS

  When DB_USER/DB_PASS are unset, values are read from the backend secrets files
  (_01_rsc_wpm_backend/secrets/db_user.txt and db_password.txt) and fail fast if
  neither the environment nor the files provide a password.

Examples:
  $0
  $0 --check container,pg_ready
  $0 -q "SELECT * from usuario LIMIT 5"
  $0 --file queries.sql
  $0 --db-name
  $0 --tables
  $0 --columns usuario
EOF
  # Help is a successful outcome and must stop here. Without this the -h branch
  # never shifts, so the argument loop spins and reprints usage forever.
  exit 0
}

fail() {
  echo -e "${RED}Error: $*${NC}" >&2
  exit 1
}

# ---------------------------------------------------------------------------
# Colors. Cleared when stdout is not a terminal so logs and CI stay clean.
# ---------------------------------------------------------------------------
setup_colors() {
  if [ "$NO_COLOR" = "true" ] || [ ! -t 1 ]; then
    RED='' GREEN='' YELLOW='' NC=''
  else
    # ANSI-C quoting: the variables hold the real ESC byte (0x1B), not the
    # literal text "\033". Only this form is safe for both print paths:
    # `printf '%s'` in run_check and `echo -e` in fail/print_summary.
    RED=$'\033[0;31m'
    GREEN=$'\033[0;32m'
    YELLOW=$'\033[1;33m'
    NC=$'\033[0m'
  fi
}

# ---------------------------------------------------------------------------
# Preflight. Fail fast with an actionable message instead of a confusing
# "command not found" from three frames deeper.
# ---------------------------------------------------------------------------
preflight() {
  command -v docker >/dev/null 2>&1 || fail "docker is not installed or not on PATH."

  if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
  elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
  else
    fail "Neither 'docker compose' nor 'docker-compose' is available."
  fi

  [ -f "$COMPOSE_FILE" ] || fail "Compose file not found: $COMPOSE_FILE
  Set COMPOSE_FILE to override."

  resolve_credentials

  export PGPASSWORD="$DB_PASS"
}

# Resolve DB_USER/DB_PASS without embedding secrets in this file. Precedence:
# explicit env (DB_USER / DB_PASS, then PGPASSWORD), then the backend secrets
# files (db_user.txt / db_password.txt), then nothing -> fail fast with an
# actionable message. Never a hardcoded fallback.
resolve_credentials() {
  if [ -n "$DB_USER" ]; then
    : # explicit
  elif [ -r "$REPO_ROOT/_01_rsc_wpm_backend/secrets/db_user.txt" ]; then
    DB_USER="$(tr -d '\r\n' < "$REPO_ROOT/_01_rsc_wpm_backend/secrets/db_user.txt")"
  else
    DB_USER="admin"
  fi

  if [ -n "$DB_PASS" ]; then
    : # explicit
  elif [ -n "${PGPASSWORD:-}" ]; then
    DB_PASS="$PGPASSWORD"
  elif [ -r "$REPO_ROOT/_01_rsc_wpm_backend/secrets/db_password.txt" ]; then
    DB_PASS="$(tr -d '\r\n' < "$REPO_ROOT/_01_rsc_wpm_backend/secrets/db_password.txt")"
  else
    fail "No database password found. Set DB_PASS or PGPASSWORD, or create
  $REPO_ROOT/_01_rsc_wpm_backend/secrets/db_password.txt first
  (run ./project-tools/rotate-db-secrets.sh init to generate it)."
  fi
}

# Run a command under a timeout when the timeout binary exists, so an
# unresponsive database fails fast instead of hanging the caller.
run_guarded() {
  if command -v timeout >/dev/null 2>&1; then
    timeout "$TIMEOUT_SECS" "$@"
  else
    "$@"
  fi
}

compose() { $COMPOSE_CMD -f "$COMPOSE_FILE" "$@"; }

# Execute SQL and return the raw value, machine-readable and unaligned.
# Quiet (-q) so notices never contaminate the value we parse. stdin is
# detached (</dev/null): run_guarded + compose exec under a TTY stdin would
# SIGTTIN-stop the process and hang the whole suite.
sql_value() {
  run_guarded $COMPOSE_CMD -f "$COMPOSE_FILE" exec -T "$DB_SERVICE" \
    psql -U "$DB_USER" -d "$DB_NAME" -q -t -A -c "$1" </dev/null 2>/dev/null
}

# Execute SQL and let psql print its own table output.
sql_display() {
  run_guarded $COMPOSE_CMD -f "$COMPOSE_FILE" exec -T "$DB_SERVICE" \
    psql -U "$DB_USER" -d "$DB_NAME" -c "$1"
}

# ---------------------------------------------------------------------------
# Health checks. Each returns 0 to pass, 1 to fail, and prints its own detail.
# ---------------------------------------------------------------------------

check_container_running() {
  # The service is passed positionally. `ps --filter name=<svc>` is rejected by
  # this compose version with "unknown filter name", so the filter form silently
  # reports an unreachable container instead of an error.
  local out rc
  set +e
  out="$(compose ps "$DB_SERVICE" --format '{{.Status}}' 2>&1)"
  rc=$?
  set -e

  if [ $rc -ne 0 ]; then
    # Surface the real error rather than reporting it as "not running".
    echo "docker compose ps failed: ${out:-no output}"
    return 1
  fi
  if [ -z "$out" ]; then
    echo "No container matches service '$DB_SERVICE'."
    echo "Start the stack with: ./project-tools/container-management.sh start-all"
    return 1
  fi
  if printf '%s' "$out" | grep -q "Up"; then
    echo "Status: $out"
    return 0
  fi
  echo "Container is not Up: $out"
  return 1
}

check_container_healthy() {
  local cid health
  cid="$(compose ps -q "$DB_SERVICE" 2>/dev/null || true)"
  if [ -z "$cid" ]; then
    echo "No running container for service '$DB_SERVICE'."
    return 1
  fi
  health="$(run_guarded docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$cid" 2>/dev/null || true)"
  case "$health" in
    healthy) echo "Health: $health" ;;
    none)    echo "The container defines no Docker healthcheck." ;;
    *)       echo "Health: ${health:-unknown}" ;;
  esac
  [ "$health" = "healthy" ]
}

check_pg_ready() {
  local out rc
  set +e
  out="$(run_guarded $COMPOSE_CMD -f "$COMPOSE_FILE" exec -T "$DB_SERVICE" \
    pg_isready -U "$DB_USER" -d "$DB_NAME" </dev/null 2>&1)"
  rc=$?
  set -e
  echo "${out:-no output}"
  return $rc
}

check_database_size() {
  local size
  if ! size="$(sql_value "SELECT pg_size_pretty(pg_database_size('$DB_NAME'));")"; then
    echo "Could not read the size of database '$DB_NAME'."
    return 1
  fi
  [ -n "$size" ] || { echo "Database '$DB_NAME' reported an empty size."; return 1; }
  echo "Size of '$DB_NAME': $size"
  return 0
}

check_table_exists() {
  local reg
  if ! reg="$(sql_value "SELECT to_regclass('$DB_SCHEMA.$DB_TABLE');")"; then
    echo "Could not query the catalog for '$DB_SCHEMA.$DB_TABLE'."
    return 1
  fi
  if [ -z "$reg" ]; then
    echo "Table '$DB_SCHEMA.$DB_TABLE' does not exist."
    return 1
  fi
  echo "Table resolves to: $reg"
  return 0
}

# Presence-only by design: extra columns are fine, missing or mistyped
# required columns are not.
check_schema() {
  local spec name type len actual required_found=0 missing=""
  local rows
  rows="$(sql_value "SELECT column_name || '|' || data_type || '|' || COALESCE(character_maximum_length::text, '')
    FROM information_schema.columns
    WHERE table_schema = '$DB_SCHEMA' AND table_name = '$DB_TABLE'
    ORDER BY ordinal_position;")" || {
    echo "Could not read information_schema.columns."; return 1; }

  for spec in "${REQUIRED_COLUMNS[@]}"; do
    IFS=':' read -r name type len <<<"$spec"
    actual="$(printf '%s\n' "$rows" | awk -F'|' -v c="$name" '$1==c {print $2 "|" $3}')"
    if [ -z "$actual" ]; then
      missing="$missing $name(absent)"
    elif [ "$actual" != "$type|$len" ]; then
      missing="$missing $name(got $actual, want $type|$len)"
    else
      required_found=$((required_found + 1))
    fi
  done

  if [ -n "$missing" ]; then
    echo "Unusable columns:$missing"
    return 1
  fi
  echo "All $required_found required columns present with expected types (extra columns ignored)."
  return 0
}

# PRIMARY KEY and UNIQUE come from pg_constraint. NOT NULL does NOT: PostgreSQL
# 16 keeps nullability in pg_attribute.attnotnull and only exposes it through
# information_schema.columns.is_nullable. Querying pg_constraint for NOT NULL
# returns nothing and makes this check permanently red.
check_constraints() {
  local missing="" found
  local rel="to_regclass('$DB_SCHEMA.$DB_TABLE')"

  found="$(sql_value "SELECT COALESCE(string_agg(a.attname, ',' ORDER BY k.ord), '')
    FROM pg_constraint c
    JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
    WHERE c.conrelid = $rel AND c.contype = 'p';")" || found=""
  [ "$found" = "id" ] || missing="$missing PK-on-id(got '${found:-none}')"

  found="$(sql_value "SELECT COALESCE(string_agg(a.attname, ',' ORDER BY k.ord), '')
    FROM pg_constraint c
    JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
    WHERE c.conrelid = $rel AND c.contype = 'u';")" || found=""
  [ "$found" = "email" ] || missing="$missing UNIQUE-on-email(got '${found:-none}')"

  for col in "${REQUIRED_NOT_NULL[@]}"; do
    found="$(sql_value "SELECT count(*) FROM information_schema.columns
      WHERE table_schema = '$DB_SCHEMA' AND table_name = '$DB_TABLE'
        AND column_name = '$col' AND is_nullable = 'NO';")" || found=""
    [ "$found" = "1" ] || missing="$missing NOT-NULL-$col"
  done

  if [ -n "$missing" ]; then
    echo "Missing constraints:$missing"
    return 1
  fi
  echo "PK on id, UNIQUE on email, NOT NULL on ${REQUIRED_NOT_NULL[*]} (extra constraints ignored)."
  return 0
}

# Reads the table and reports the count. An empty table warns instead of
# failing: no seed script is committed, so a fresh clone legitimately has zero
# rows and a hard failure here would be a false alarm.
check_data_readable() {
  local count
  if ! count="$(sql_value "SELECT count(*) FROM $DB_SCHEMA.$DB_TABLE;")"; then
    echo "Could not read '$DB_SCHEMA.$DB_TABLE'."
    return 1
  fi
  echo "Rows in '$DB_TABLE': $count"
  if [ "$count" = "0" ]; then
    echo "$WARN_SENTINEL table is empty. Expected on a fresh clone (no seed script)."
  fi
  return 0
}

# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------
PASSED=0
FAILED=0
WARNINGS=0

CHECK_NAMES=(container health pg_ready db_size table schema constraints data)
CHECK_FUNCS=(
  check_container_running
  check_container_healthy
  check_pg_ready
  check_database_size
  check_table_exists
  check_schema
  check_constraints
  check_data_readable
)

run_check() {
  local name="$1" func="$2" out rc start elapsed
  start=$(date +%s%N)
  set +e
  out="$("$func" 2>&1)"
  rc=$?
  set -e
  elapsed=$(( ($(date +%s%N) - start) / 1000000 ))

  if [ $rc -eq 0 ]; then
    PASSED=$((PASSED + 1))
  else
    FAILED=$((FAILED + 1))
  fi

  # Warnings arrive as sentinel lines from inside the subshell. Strip the
  # sentinel, tally it, and keep the message with the check output.
  local warned=""
  if printf '%s\n' "$out" | grep -q "^$WARN_SENTINEL "; then
    warned="$(printf '%s\n' "$out" | grep "^$WARN_SENTINEL " | sed "s/^$WARN_SENTINEL //")"
    WARNINGS=$((WARNINGS + 1))
    # grep exits 1 when it filters every line, which would trip set -e.
    out="$(printf '%s\n' "$out" | grep -v "^$WARN_SENTINEL " || true)"
  fi

  if [ $rc -eq 0 ]; then
    printf '%s[ PASS ]%s %-12s %4dms  %s\n' "$GREEN" "$NC" "$name" "$elapsed" "$out"
  else
    printf '%s[ FAIL ]%s %-12s %4dms  %s\n' "$RED" "$NC" "$name" "$elapsed" "$out"
  fi
  if [ -n "$warned" ]; then
    printf '%s[ WARN ]%s %s\n' "$YELLOW" "$NC" "$warned"
  fi
  return 0
}

print_summary() {
  local total=$((PASSED + FAILED))
  echo ""
  if [ "$FAILED" -eq 0 ]; then
    if [ "$WARNINGS" -gt 0 ]; then
      echo -e "${YELLOW}${PASSED}/${total} checks passed${NC}, $WARNINGS warning(s)"
    else
      echo -e "${GREEN}${PASSED}/${total} checks passed${NC}"
    fi
  else
    echo -e "${RED}${PASSED}/${total} checks passed${NC}, $FAILED failed"
  fi
}

run_suite() {
  local filter="$1"
  local -a wanted=()
  if [ -n "$filter" ]; then
    IFS=',' read -r -a wanted <<<"$filter"
    local req name known
    for req in "${wanted[@]}"; do
      req="$(printf '%s' "$req" | tr -d '[:space:]')"
      [ -n "$req" ] || continue
      known=false
      for name in "${CHECK_NAMES[@]}"; do
        [ "$name" = "$req" ] && known=true && break
      done
      $known || fail "Unknown check: $req
  Available: ${CHECK_NAMES[*]}"
    done
  fi

  local i name
  for i in "${!CHECK_NAMES[@]}"; do
    name="${CHECK_NAMES[$i]}"
    if [ -n "$filter" ]; then
      local req match=false
      for req in "${wanted[@]}"; do
        [ "$(printf '%s' "$req" | tr -d '[:space:]')" = "$name" ] && match=true && break
      done
      $match || continue
    fi
    run_check "$name" "${CHECK_FUNCS[$i]}"
  done

  print_summary
  [ "$FAILED" -eq 0 ]
}

# ---------------------------------------------------------------------------
# Query mode
# ---------------------------------------------------------------------------
require_container_for_queries() {
  local cid
  cid="$(compose ps -q "$DB_SERVICE" 2>/dev/null || true)"
  [ -n "$cid" ] || fail "The '$DB_SERVICE' container is not running, so queries cannot run.
  Start the stack with: ./project-tools/container-management.sh start-all"
}

run_query() {
  local sql="$1" label="${2:-}"
  if [ -n "$label" ]; then
    echo ">>> [$label] $sql"
  else
    echo ">>> $sql"
  fi
  # stdin is detached deliberately. `docker compose exec` inherits this
  # process's stdin, so when called from a `while read` loop it drains the file
  # being read and the loop silently stops after the first query.
  run_guarded $COMPOSE_CMD -f "$COMPOSE_FILE" exec -T "$DB_SERVICE" \
    psql -U "$DB_USER" -d "$DB_NAME" -c "$sql" </dev/null
}

run_queries() {
  local q
  require_container_for_queries
  for q in "${QUERIES[@]}"; do
    if ! run_query "$q"; then
      fail "Query failed: $q"
    fi
  done
}

run_query_file() {
  local file="$1" line_num=0 query
  [ -f "$file" ] || fail "Query file not found: $file"
  require_container_for_queries

  while IFS= read -r query || [ -n "$query" ]; do
    line_num=$((line_num + 1))
    case "$query" in
      ''|\#*) continue ;;
    esac
    if ! run_query "$query" "$line_num"; then
      fail "Query failed at line $line_num: $query"
    fi
  done <"$file"
}

# ---------------------------------------------------------------------------
# Introspection mode. Single-intent, machine-readable discovery of the live
# schema. Output is raw (-t -A via sql_value) so the result can be captured
# into a variable, e.g. name="$(db-healthcheck.sh --db-name)".
# ---------------------------------------------------------------------------
show_database_name() {
  require_container_for_queries
  local name
  name="$(sql_value "SELECT current_database();")" || fail "Could not read the database name."
  [ -n "$name" ] || fail "The database reported an empty name."
  printf '%s\n' "$name"
}

show_tables() {
  require_container_for_queries
  local tables
  tables="$(sql_value "SELECT table_name FROM information_schema.tables
    WHERE table_schema = '$DB_SCHEMA' AND table_type = 'BASE TABLE'
    ORDER BY table_name;")" || fail "Could not list tables in schema '$DB_SCHEMA'."
  printf '%s\n' "$tables"
}

show_columns() {
  local table="$1"
  require_container_for_queries
  local reg cols
  reg="$(sql_value "SELECT to_regclass('$DB_SCHEMA.$table');")" || fail "Could not query the catalog for '$DB_SCHEMA.$table'."
  [ -n "$reg" ] || fail "Table '$DB_SCHEMA.$table' does not exist."
  cols="$(sql_value "SELECT column_name, data_type, COALESCE(character_maximum_length::text, ''), is_nullable
    FROM information_schema.columns
    WHERE table_schema = '$DB_SCHEMA' AND table_name = '$table'
    ORDER BY ordinal_position;")" || fail "Could not read information_schema.columns for '$DB_SCHEMA.$table'."
  printf '%s\n' "$cols"
}

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
QUERIES=()
QUERY_FILE=""
CHECK_FILTER=""
SHOW_DB_NAME="false"
SHOW_TABLES="false"
SHOW_COLUMNS_TABLE=""
NO_COLOR="false"

while [ $# -gt 0 ]; do
  case "$1" in
    -q|--query)
      [ $# -ge 2 ] || fail "$1 requires a SQL argument."
      QUERIES+=("$2")
      shift 2
      ;;
    --file)
      [ $# -ge 2 ] || fail "--file requires a path."
      [ -z "$QUERY_FILE" ] || fail "--file given more than once."
      QUERY_FILE="$2"
      shift 2
      ;;
    --check)
      [ $# -ge 2 ] || fail "--check requires a comma-separated list."
      [ -z "$CHECK_FILTER" ] || fail "--check given more than once."
      CHECK_FILTER="$2"
      shift 2
      ;;
    --db-name)
      SHOW_DB_NAME="true"
      shift
      ;;
    --tables)
      SHOW_TABLES="true"
      shift
      ;;
    --columns)
      [ $# -ge 2 ] || fail "--columns requires a table name."
      [ -z "$SHOW_COLUMNS_TABLE" ] || fail "--columns given more than once."
      SHOW_COLUMNS_TABLE="$2"
      shift 2
      ;;
    --no-color)
      NO_COLOR="true"
      shift
      ;;
    -h|--help)
      NO_COLOR="false"
      setup_colors
      usage
      ;;
    *)
      fail "Unknown option: $1
  Run '$0 --help' for usage."
      ;;
  esac
done

setup_colors
preflight

# Mode arbitration: every mode is single-intent and they never overlap.
MODES=0
[ "${#QUERIES[@]}" -gt 0 ] && MODES=$((MODES + 1))
[ -n "$QUERY_FILE" ] && MODES=$((MODES + 1))
[ -n "$CHECK_FILTER" ] && MODES=$((MODES + 1))
[ "$SHOW_DB_NAME" = "true" ] && MODES=$((MODES + 1))
[ "$SHOW_TABLES" = "true" ] && MODES=$((MODES + 1))
[ -n "$SHOW_COLUMNS_TABLE" ] && MODES=$((MODES + 1))
[ "$MODES" -gt 1 ] && fail "Choose one mode: --check, -q/--query, --file, --db-name, --tables, or --columns (they cannot be combined)."

if [ "${#QUERIES[@]}" -gt 0 ]; then
  run_queries
elif [ -n "$QUERY_FILE" ]; then
  run_query_file "$QUERY_FILE"
elif [ "$SHOW_DB_NAME" = "true" ]; then
  show_database_name
elif [ "$SHOW_TABLES" = "true" ]; then
  show_tables
elif [ -n "$SHOW_COLUMNS_TABLE" ]; then
  show_columns "$SHOW_COLUMNS_TABLE"
else
  run_suite "$CHECK_FILTER"
fi
