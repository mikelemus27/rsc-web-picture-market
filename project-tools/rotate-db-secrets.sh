#!/usr/bin/env bash
# Project-tools: create or rotate PostgreSQL credentials for the Compose stack.
# Author: miguel.gallardo.lemus@gmail.com
# Usage: ./project-tools/rotate-db-secrets.sh init | rotate [--check] | status
#
# One generator, manual by design. No cron, no timers: rotation happens only when
# a human decides it is really needed.
#
# Secret values are read from files inside this script and written to files with
# mode 600; they are never printed to stdout.
#
# Rotation is fail-closed: if the live-stack conditions are not met, NO rotation
# is performed, the situation is reported, and the caller is told to review.
#
# A live rotation applies the new password to the database with ALTER USER.
# Rebuilding/recreating the postgres container does NOT change the password on an
# existing volume; only ALTER USER (or a destructive volume recreation) does.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SECRETS_DIR="$REPO_ROOT/_01_rsc_wpm_backend/secrets"
DB_USER_FILE="$SECRETS_DIR/db_user.txt"
DB_PASSWORD_FILE="$SECRETS_DIR/db_password.txt"
COMPOSE_FILE="${COMPOSE_FILE:-$REPO_ROOT/_01_rsc_wpm_backend/docker-compose.yml}"
ENV_FILE="$REPO_ROOT/.env"

DB_SERVICE="${DB_SERVICE:-postgres}"
BACKEND_SERVICE="${BACKEND_SERVICE:-backend}"
DB_NAME="${DB_NAME:-wpm_db}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
HEALTH_URL="${HEALTH_URL:-http://localhost:4001/health}"

COMPOSE_CMD=""

# Colors. Cleared when stdout is not a terminal so logs and CI stay clean.
RED='' GREEN='' YELLOW='' NC=''
setup_colors() {
  if [ "$NO_COLOR" = "true" ] || [ ! -t 1 ]; then
    RED='' GREEN='' YELLOW='' NC=''
  else
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    NC='\033[0m'
  fi
}
NO_COLOR="${NO_COLOR:-false}"

fail() {
  echo -e "${RED}Error: $*${NC}" >&2
  exit 1
}

usage() {
  cat <<EOF
Usage: $0 {init|rotate|status} [--check] [--force] [--no-color]

Tools:
  init
      Create secrets/db_user.txt (default "admin") and secrets/db_password.txt
      with a fresh random password (openssl rand -base64 32), mode 600, and
      regenerate the derived root .env. Refuses to overwrite an existing
      password unless --force is given. No Docker required; intended for fresh
      clones and first-time setup.

  rotate --check
      Evaluate every condition required for a safe live rotation and report
      PASS/FAIL per condition. Read-only: changes nothing.

  rotate
      Fail-closed live rotation:
        1. Evaluate the same conditions as --check; any FAIL -> NO rotation is
           performed, the blocked conditions are reported, exit 1.
        2. Write a new secrets/db_password.txt and regenerate root .env.
        3. ALTER USER <db_user> WITH PASSWORD '<new>' on the live postgres
           container (socket trust; no old password needed).
        4. Recreate only the backend container so it re-reads the secret mount
           (no image rebuild: compose secrets are runtime mounts).
        5. Verify GET \$HEALTH_URL returns HTTP 200.
      Manual, on-demand: run it only when rotation is really needed.

  status
      Read-only report: secrets present, .env present, postgres container
      running/health, backend /health.

Options:
  --force    init: overwrite an existing db_password.txt with a new one.
  --no-color Disable ANSI color (also automatic when not a TTY).

Environment overrides:
  DB_SERVICE BACKEND_SERVICE DB_NAME DB_HOST DB_PORT COMPOSE_FILE HEALTH_URL
EOF
  exit 0
}

# ---------------------------------------------------------------------------
# Preflight
# ---------------------------------------------------------------------------
preflight() {
  command -v docker >/dev/null 2>&1 || fail "docker is not installed or not on PATH."
  command -v openssl >/dev/null 2>&1 || fail "openssl is not installed or not on PATH."

  if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
  elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
  else
    fail "Neither 'docker compose' nor 'docker-compose' is available."
  fi

  [ -f "$COMPOSE_FILE" ] || fail "Compose file not found: $COMPOSE_FILE
  Set COMPOSE_FILE to override."
}

compose() { $COMPOSE_CMD -f "$COMPOSE_FILE" "$@"; }

# ---------------------------------------------------------------------------
# Secret file helpers. Values move between files and variables; never to stdout.
# ---------------------------------------------------------------------------
random_password() {
  openssl rand -base64 32 | tr -d '\n'
}

read_secret() { # $1 file -> value on stdout
  tr -d '\r\n' < "$1"
}

ensure_secret_dir() {
  mkdir -p "$SECRETS_DIR"
  # The directory defaults to the backend .gitignore's secrets/ rule, but stay
  # explicit about permissions anyway.
  chmod 700 "$SECRETS_DIR" 2>/dev/null || true
}

write_secret() { # $1 file $2 value
  umask 077
  printf '%s' "$2" > "$1.tmp"
  mv "$1.tmp" "$1"
  chmod 600 "$1"
}

# root .env is DERIVED from the secrets files; never edit it by hand.
# DB_HOST is localhost here: this file serves local non-Docker runs, while the
# compose backend reaches postgres on the compose network by service name.
write_env_file() { # $1 user $2 password
  umask 077
  cat > "$ENV_FILE.tmp" <<EOF
# Generated by project-tools/rotate-db-secrets.sh — do not edit by hand.
# Re-run init/rotate to regenerate.
POSTGRES_USER=$1
POSTGRES_PASSWORD=$2
POSTGRES_DB=$DB_NAME
DB_HOST=$DB_HOST
DB_USER=$1
DB_PASSWORD=$2
DB_NAME=$DB_NAME
DB_PORT=$DB_PORT
EOF
  mv "$ENV_FILE.tmp" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
}

# ---------------------------------------------------------------------------
# Live-stack condition evaluation (the fail-closed gate)
# ---------------------------------------------------------------------------
conditions_ok=1
condition_line() { # $1 ok(0/1) $2 text
  if [ "$1" -eq 0 ]; then
    printf '%s[ PASS ]%s %s\n' "$GREEN" "$NC" "$2"
  else
    printf '%s[ FAIL ]%s %s\n' "$RED" "$NC" "$2"
    conditions_ok=0
  fi
}

postgres_running() {
  local cid
  cid="$(compose ps -q "$DB_SERVICE" 2>/dev/null || true)"
  [ -n "$cid" ]
}

postgres_healthy() {
  local cid health
  cid="$(compose ps -q "$DB_SERVICE" 2>/dev/null || true)"
  [ -n "$cid" ] || return 1
  health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$cid" 2>/dev/null || true)"
  [ "$health" = "healthy" ]
}

db_user_value() {
  if [ -r "$DB_USER_FILE" ]; then
    read_secret "$DB_USER_FILE"
  else
    printf 'admin'
  fi
}

evaluate_conditions() {
  local user
  conditions_ok=1

  [ -d "$SECRETS_DIR" ] && condition_line 0 "secrets dir present: $SECRETS_DIR" \
                        || condition_line 1 "secrets dir missing: $SECRETS_DIR"
  [ -r "$DB_PASSWORD_FILE" ] && condition_line 0 "current password file present" \
                             || condition_line 1 "current password file missing: $DB_PASSWORD_FILE"

  user="$(db_user_value)"
  [ -r "$DB_USER_FILE" ] && condition_line 0 "user file present (user: $user)" \
                         || condition_line 1 "user file missing (would default to: $user)"

  [ -f "$COMPOSE_FILE" ] && condition_line 0 "compose file present" \
                          || condition_line 1 "compose file missing: $COMPOSE_FILE"

  if postgres_running; then
    condition_line 0 "postgres container running"
  else
    condition_line 1 "postgres container not running — ALTER USER impossible"
  fi

  if postgres_healthy; then
    condition_line 0 "postgres container healthy"
  else
    condition_line 1 "postgres container not healthy — refuse rotation on an unhealthy DB"
  fi

  [ $conditions_ok -eq 0 ] && return 1 || return 0
}

refusal_banner() {
  echo ""
  echo -e "${RED}Rotation NOT performed — conditions are not met.${NC}"
  echo "No secret file was changed and no database statement was run."
  echo "Review the blocked conditions above, fix them, then re-run."
  echo "Nothing was generated or rotated; the situation needs human review."
}

# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------
cmd_init() {
  ensure_secret_dir

  local user
  user="$(db_user_value)"
  if [ ! -f "$DB_USER_FILE" ]; then
    write_secret "$DB_USER_FILE" "$user"
    echo "Created $DB_USER_FILE (user: $user)"
  else
    echo "Kept existing $DB_USER_FILE (user: $user)"
  fi

  local password
  if [ -f "$DB_PASSWORD_FILE" ] && [ "${FORCE:-0}" != "1" ]; then
    password="$(read_secret "$DB_PASSWORD_FILE")"
    echo "Kept existing password ($(printf '%s' "$password" | wc -c) bytes). Use --force to rotate it."
  else
    password="$(random_password)"
    write_secret "$DB_PASSWORD_FILE" "$password"
    echo "Created/rotated $DB_PASSWORD_FILE ($(printf '%s' "$password" | wc -c) bytes, mode 600)."
  fi

  write_env_file "$user" "$password"
  echo "Regenerated $ENV_FILE (mode 600, derived from secrets)."

  echo ""
  echo "Next: start the stack with ./project-tools/container-management.sh start-all"
  echo "A fresh postgres volume reads these files on first start."
}

cmd_rotate_check() {
  echo "Rotation conditions:"
  if ! evaluate_conditions; then
    echo ""
    refusal_banner
    return 1
  fi
  echo ""
  echo -e "${GREEN}Conditions OK — a live rotation can proceed.${NC}"
  return 0
}

cmd_rotate() {
  echo "Checking rotation conditions..."
  if ! evaluate_conditions; then
    refusal_banner
    return 1
  fi
  echo -e "${GREEN}All conditions met.${NC}"
  echo ""

  local user password cid
  user="$(db_user_value)"
  password="$(random_password)"

  # 1) Persist the new value FIRST so a mid-rotation failure leaves the secret
  #    files coherent and the running stack untouched (backend is recreated last).
  write_secret "$DB_PASSWORD_FILE" "$password"
  write_env_file "$user" "$password"
  echo "1/5 wrote new $DB_PASSWORD_FILE ($(printf '%s' "$password" | wc -c) bytes) and regenerated $ENV_FILE"

  # 2) Apply to the live database. Socket trust makes ALTER USER work even
  #    though the old password is unknown to this script.
  cid="$(compose ps -q "$DB_SERVICE")"
  echo "2/5 applying password to live postgres ($cid)..."
  if ! docker exec "$cid" psql -U "$user" -d "$DB_NAME" \
      -c "ALTER USER \"$user\" WITH PASSWORD '$password'" >/dev/null; then
    echo ""
    echo -e "${RED}ALTER USER FAILED.${NC} The secret file was updated but the database still has"
    echo "the previous password. The running backend was NOT recreated, so the stack is still"
    echo "healthy with the previous credentials. Fix the cause, then re-run $0 rotate."
    return 1
  fi
  echo "   password applied to database"

  # 3) Recreate ONLY backend so it re-reads the secret mount. No image rebuild:
  #    compose secrets are runtime-mounted files, not baked into the image.
  echo "3/5 recreating backend container to re-read the secret..."
  compose up -d --force-recreate "$BACKEND_SERVICE" >/dev/null

  # 4) Verify.
  echo "4/5 verifying $HEALTH_URL..."
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' "$HEALTH_URL" || true)"
  if [ "$code" = "200" ]; then
    echo -e "${GREEN}5/5 rotation complete — /health returns 200.${NC}"
    echo "Local tools (db-healthcheck.sh) pick up the new password from the regenerated .env / secret file."
  else
    echo ""
    echo -e "${RED}VERIFICATION FAILED: /health returned ${code:-no response}.${NC}"
    echo "Rotation was applied but the stack did not come back healthy."
    echo "Review container logs: docker compose -f $COMPOSE_FILE logs $BACKEND_SERVICE"
    return 1
  fi
}

cmd_status() {
  local user pw_bytes env_state db_state backend_state health
  user="$([ -r "$DB_USER_FILE" ] && read_secret "$DB_USER_FILE" || echo "missing (default would be admin)")"
  pw_bytes="$([ -r "$DB_PASSWORD_FILE" ] && wc -c < "$DB_PASSWORD_FILE" | tr -d ' ' || echo "missing")"
  env_state="$([ -f "$ENV_FILE" ] && echo "present" || echo "missing")"

  if postgres_running; then
    if postgres_healthy; then
      db_state="running (healthy)"
    else
      db_state="running (NOT healthy)"
    fi
  else
    db_state="not running"
  fi

  local backend_cid
  backend_cid="$(compose ps -q "$BACKEND_SERVICE" 2>/dev/null || true)"
  backend_state="$([ -n "$backend_cid" ] && echo "running" || echo "not running")"

  health="$(curl -s -o /dev/null -w '%{http_code}' "$HEALTH_URL" || true)"
  [ "$health" = "200" ] && health="200 (ok)" || health="${health:-no response}"

  echo "Secrets:"
  echo "  db_user_file:     $user"
  echo "  db_password_file: $pw_bytes bytes, mode $( [ -r "$DB_PASSWORD_FILE" ] && stat -c '%a' "$DB_PASSWORD_FILE" || echo 'n/a')"
  echo "Stack:"
  echo "  .env (root):      $env_state"
  echo "  postgres:         $db_state"
  echo "  backend:          $backend_state"
  echo "  /health:          $health"
  echo ""
  echo "Rotation: manual only. Run '$0 rotate --check' to verify a live rotation could proceed."
}

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
MODE=""
FORCE=0

while [ $# -gt 0 ]; do
  case "$1" in
    init|rotate|status)
      [ -z "$MODE" ] || fail "Choose one command: init, rotate, or status."
      MODE="$1"
      shift
      ;;
    --check)
      [ "$MODE" = "rotate" ] || fail "--check only applies to 'rotate'."
      CHECK_ONLY=1
      shift
      ;;
    --force)
      FORCE=1
      shift
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

case "$MODE" in
  init)
    cmd_init
    ;;
  rotate)
    if [ "${CHECK_ONLY:-0}" = "1" ]; then
      cmd_rotate_check
    else
      cmd_rotate
    fi
    ;;
  status)
    cmd_status
    ;;
  *)
    fail "No command given. Run '$0 --help' for usage."
    ;;
esac