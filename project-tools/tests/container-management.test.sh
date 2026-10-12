#!/usr/bin/env sh
# Regression harness for project-tools/container-management.sh (fix plan T8).
#
# Usage:
#   sh project-tools/tests/container-management.test.sh [script-under-test]
#
# The optional first argument names the script to test. It defaults to the
# script beside this harness' parent directory (../container-management.sh),
# so plain `sh container-management.test.sh` always tests the real script.
# The argument exists so a mutated COPY of the script can be proven to fail
# without ever touching the real one.
#
# Prints `ok`/`FAIL` per assertion plus a summary, and exits non-zero if any
# assertion failed. Case 5 needs a working `docker` CLI (it only runs the
# read-only `docker ps`).

HARNESS_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="${1:-$HARNESS_DIR/../container-management.sh}"

total=0
failures=0

pass() {
  total=$((total + 1))
  printf 'ok %s - %s\n' "$total" "$1"
}

fail() {
  total=$((total + 1))
  failures=$((failures + 1))
  printf 'FAIL %s - %s\n' "$total" "$1"
}

assert_eq() { # <desc> <expected> <actual>
  if [ "$2" = "$3" ]; then
    pass "$1"
  else
    fail "$1 (expected [$2], got [$3])"
  fi
}

assert_ne() { # <desc> <not-expected> <actual>
  if [ "$2" != "$3" ]; then
    pass "$1"
  else
    fail "$1 (expected anything but [$2])"
  fi
}

assert_contains() { # <desc> <needle> <haystack>
  case "$3" in
    *"$2"*) pass "$1" ;;
    *) fail "$1 (output does not contain [$2])" ;;
  esac
}

assert_not_contains() { # <desc> <needle> <haystack>
  case "$3" in
    *"$2"*) fail "$1 (output contains [$2])" ;;
    *) pass "$1" ;;
  esac
}

if [ ! -f "$SCRIPT" ]; then
  printf 'FAIL - script under test not found: %s\n' "$SCRIPT"
  exit 1
fi

# ---------------------------------------------------------------------------
# Case 1: the guard distinguishes a compose error from a stopped container.
# The copy's REPO_ROOT has no compose file, so `test-frontend` must fail
# inside the guard with compose's own error naming the missing file — never
# with the misleading "Backend not running" that the pre-fix code printed.
# This also proves the guard is wired into `test-frontend` (T4): output like
# this can only come from the guard firing at its call site.
# ---------------------------------------------------------------------------
workdir="$(mktemp -d "${TMPDIR:-/tmp}/cm-harness.XXXXXX")" || exit 1
trap 'rm -rf "$workdir"' EXIT HUP INT TERM
mkdir -p "$workdir/project-tools"
cp "$SCRIPT" "$workdir/project-tools/container-management.sh"
out="$(sh "$workdir/project-tools/container-management.sh" test-frontend 2>&1)"
rc=$?
assert_contains "guard names the missing compose file" \
  "_01_rsc_wpm_backend/docker-compose.yml" "$out"
assert_not_contains "guard does not claim 'not running' for a tool error" \
  "not running" "$out"
assert_eq "guard exits 1 on a compose failure" "1" "$rc"

# ---------------------------------------------------------------------------
# Case 2: no `docker compose ps --filter name=` (the invalid flag, T1).
# `docker compose ps` has no `name` filter; the original script passed it and
# every guard call failed silently. Asserted globally: the script must not
# pass --filter to any docker command.
# ---------------------------------------------------------------------------
assert_eq "script passes no --filter flags to docker" "0" \
  "$(grep -c -- '--filter' "$SCRIPT")"

# ---------------------------------------------------------------------------
# Case 3: `help` is a successful request, so it must exit 0.
# ---------------------------------------------------------------------------
sh "$SCRIPT" help >/dev/null 2>&1
assert_eq "help exits 0" "0" "$?"

# ---------------------------------------------------------------------------
# Case 4: an unknown action is named instead of dumping the full help text.
# ---------------------------------------------------------------------------
out="$(sh "$SCRIPT" start-al 2>&1)"
rc=$?
assert_contains "unknown action is named" "Unknown action: start-al" "$out"
assert_eq "unknown action exits 1" "1" "$rc"

# ---------------------------------------------------------------------------
# Case 5: stop-running-containers refuses without a TTY and stops nothing.
# stdin is /dev/null (not a terminal): the action must refuse BEFORE the
# confirmation prompt, so no `docker stop` can ever be reached. This locks in
# the deliberate safety guard so a later "cleanup" cannot remove it.
# ---------------------------------------------------------------------------
out="$(sh "$SCRIPT" stop-running-containers </dev/null 2>&1)"
rc=$?
assert_contains "non-TTY run prints the refusal" \
  "Refusing to stop containers without an interactive confirmation" "$out"
assert_ne "non-TTY run exits non-zero" "0" "$rc"
assert_not_contains "refusal fires before the confirmation prompt" \
  "Type 'stop' to continue" "$out"

# ---------------------------------------------------------------------------
# Case 6 (T4/T5): no guard function is defined and never called.
# check_backend_running needs a definition plus at least one call site;
# check_frontend_network was deleted outright.
# ---------------------------------------------------------------------------
mentions="$(grep -c 'check_backend_running' "$SCRIPT")"
if [ "${mentions:-0}" -ge 2 ]; then
  pass "check_backend_running is defined and called"
else
  fail "check_backend_running is defined and called (found ${mentions:-0} mention(s), expected definition + call site)"
fi
assert_eq "check_frontend_network is gone" "0" \
  "$(grep -c 'check_frontend_network' "$SCRIPT")"

# ---------------------------------------------------------------------------
# Case 7 (T6): the frontend container literal exists exactly once — in the
# FRONTEND_CONTAINER definition — and nowhere else.
# ---------------------------------------------------------------------------
assert_eq "frontend container literal appears exactly once" "1" \
  "$(grep -c '02_rsc_wp_bun_vue_frontend' "$SCRIPT")"

# ---------------------------------------------------------------------------
# check-ports cases (issue #50, T1/T4/T5).
#
# A stub `docker` is placed earlier on PATH: it logs every invocation's argv
# (one `ARG <element>` line per element) to $STUB_LOG and answers the read-only
# inspection verbs check-ports issues. The real Docker is never reached by
# these cases. The copy of the script made for Case 1 (whose REPO_ROOT is this
# temp dir) is the script under test, so the root .env and PATH are controlled
# here — the live stack is never touched.
# ---------------------------------------------------------------------------
stubdir="$workdir/stub"
mkdir -p "$stubdir"
cat > "$stubdir/docker" <<'STUB'
#!/usr/bin/env sh
printf '>> %s\n' "$*" >> "$STUB_LOG"
for _a in "$@"; do printf 'ARG %s\n' "$_a" >> "$STUB_LOG"; done
case "$1" in
  compose)
    case "$*" in
      *" ps "*)
        if [ "${STUB_COMPOSE_PS_RC:-0}" -ne 0 ]; then
          printf '%s\n' "stub: compose ps failed" >&2
          exit "${STUB_COMPOSE_PS_RC}"
        fi
        _svc=""
        for _a in "$@"; do _svc="$_a"; done
        case "$_svc" in
          backend) [ -n "${STUB_BACKEND_ID:-}" ] && printf '%s\n' "$STUB_BACKEND_ID" ;;
          frontend) [ -n "${STUB_FRONTEND_ID:-}" ] && printf '%s\n' "$STUB_FRONTEND_ID" ;;
        esac
        exit 0
        ;;
    esac
    ;;
  port)
    if [ "${STUB_PORT_RC:-0}" -ne 0 ]; then
      printf '%s\n' "stub: port failed" >&2
      exit "${STUB_PORT_RC}"
    fi
    [ -n "${STUB_HOST_PORT:-}" ] && printf '4001/tcp -> 0.0.0.0:%s\n' "$STUB_HOST_PORT"
    exit 0
    ;;
  inspect)
    # Invoked as `docker inspect -f <template> <target>`: -f is $2.
    _tmpl="$3"
    _target="$4"
    case "$_tmpl" in
      *Config.Env*)
        if [ "$_target" = "${STUB_BACKEND_ID:-}" ] && [ -n "${STUB_BACKEND_ENV_PORT:-}" ]; then
          printf 'PORT=%s\n' "$STUB_BACKEND_ENV_PORT"
        fi
        if [ "$_target" = "${STUB_FRONTEND_ID:-}" ] && [ -n "${STUB_FRONTEND_ENV_PORT:-}" ]; then
          printf 'PORT=%s\n' "$STUB_FRONTEND_ENV_PORT"
        fi
        exit 0
        ;;
      *State.Running*)
        if [ "$_target" = "${STUB_BACKEND_ID:-}" ]; then
          printf '%s\n' "${STUB_BACKEND_RUNNING:-true}"
        else
          printf '%s\n' "${STUB_FRONTEND_RUNNING:-false}"
        fi
        exit 0
        ;;
      *State.ExitCode*) printf '0\n'; exit 0 ;;
    esac
    exit 0
    ;;
esac
exit 0
STUB
chmod +x "$stubdir/docker"

# A controlled root .env so check-ports has a source PORT to compare against.
printf 'PORT=4001\n' > "$workdir/.env"
cp_log="$workdir/stub.log"
cm="$workdir/project-tools/container-management.sh"

# assert_no_mutating_verbs <path-label> — scan $cp_log for a docker verb that
# would change state. The stub logs one `ARG <element>` line per argv element,
# and the match is on a whole element, so a path containing e.g. "run" cannot
# mask a real `run` verb. This is the assertion that keeps `check-ports` a
# detector: an action that "helpfully" recreated the containers would
# reintroduce the very drift it exists to catch.
assert_no_mutating_verbs() { # <path-label>
  _verbs=""
  for _v in up run rm create start stop restart build rmi exec; do
    if grep -qx "ARG $_v" "$cp_log"; then
      _verbs="$_verbs $_v"
    fi
  done
  if [ -z "$_verbs" ]; then
    pass "check-ports reaches no mutating docker verb ($1)"
  else
    fail "check-ports reached mutating docker verb(s) ($1):$_verbs"
  fi
}

# Case: check-ports is advertised in usage and has a real case arm (T1).
assert_contains "check-ports is listed in usage" "check-ports" "$(sh "$SCRIPT" help 2>&1)"
assert_eq "check-ports has a case arm" "1" "$(grep -c '^  check-ports)' "$SCRIPT")"

# Contract row: backend published host port AND env PORT both equal the source.
# A frontend container is present and matching too, so the frontend's read path
# runs and is covered by the read-only probe below.
: > "$cp_log"
out="$(STUB_LOG="$cp_log" STUB_BACKEND_ID=stubbeef STUB_HOST_PORT=4001 STUB_BACKEND_ENV_PORT=4001 \
  STUB_FRONTEND_ID=stubfr0nt STUB_FRONTEND_ENV_PORT=4001 \
  PATH="$stubdir:$PATH" sh "$cm" check-ports 2>&1)"
rc=$?
assert_eq "check-ports exits 0 when host and env PORT match the source" "0" "$rc"
assert_contains "check-ports prints a match line per value" "matches source" "$out"
assert_not_contains "check-ports prints no mismatch when in sync" "mismatch" "$out"

# Contract row: either value differs -> mismatch, recreate remedy, exit 1.
: > "$cp_log"
out="$(STUB_LOG="$cp_log" STUB_BACKEND_ID=stubbeef STUB_HOST_PORT=4001 STUB_BACKEND_ENV_PORT=5055 \
  PATH="$stubdir:$PATH" sh "$cm" check-ports 2>&1)"
rc=$?
assert_eq "check-ports exits 1 when a value drifts from the source" "1" "$rc"
assert_contains "check-ports names the mismatch" "mismatch" "$out"
assert_contains "check-ports prints the recreate remedy" "up -d --force-recreate" "$out"
assert_not_contains "check-ports remedy is never a rebuild" "build --no-cache" "$out"
# The mismatch path is where a "helpful" auto-fix would be added, so the
# read-only guarantee is asserted here too, not only on the match path.
assert_no_mutating_verbs "mismatch path"

# Contract row: no backend container exists -> nothing to check, exit 0.
: > "$cp_log"
out="$(STUB_LOG="$cp_log" STUB_BACKEND_ID= \
  PATH="$stubdir:$PATH" sh "$cm" check-ports 2>&1)"
rc=$?
assert_eq "check-ports exits 0 when no backend container exists" "0" "$rc"
assert_contains "check-ports says nothing is running to check" "nothing running to check" "$out"

# Contract row: compose fails -> tool failure with its own error, exit 1.
: > "$cp_log"
out="$(STUB_LOG="$cp_log" STUB_COMPOSE_PS_RC=1 \
  PATH="$stubdir:$PATH" sh "$cm" check-ports 2>&1)"
rc=$?
assert_eq "check-ports exits 1 when compose fails" "1" "$rc"
assert_contains "check-ports surfaces the tool's own error" "stub: compose ps failed" "$out"
assert_not_contains "check-ports never reports a tool failure as 'not running'" "not running" "$out"
assert_not_contains "check-ports does not claim nothing is running on a tool failure" \
  "nothing running to check" "$out"

# Read-only guarantee (T4): the stub log must contain only inspection verbs and
# the copied script tree must be byte-identical before and after.
: > "$cp_log"
before="$(find "$workdir/project-tools" -type f -exec cksum {} \; | sort)"
out="$(STUB_LOG="$cp_log" STUB_BACKEND_ID=stubbeef STUB_HOST_PORT=4001 STUB_BACKEND_ENV_PORT=4001 \
  PATH="$stubdir:$PATH" sh "$cm" check-ports 2>&1)"
rc=$?
after="$(find "$workdir/project-tools" -type f -exec cksum {} \; | sort)"
readonly_log="$(cat "$cp_log" 2>/dev/null)"
assert_eq "read-only probe exits 0" "0" "$rc"
assert_ne "read-only probe actually invoked the docker stub" "" "$readonly_log"
assert_eq "check-ports left the copied script tree byte-identical" "$before" "$after"
assert_contains "read-only probe reached an inspection verb (inspect)" "ARG inspect" "$readonly_log"
assert_no_mutating_verbs "match path, frontend present"

# Case: restart-frontend is implemented, not the catch-all (T2).
assert_eq "restart-frontend has a case arm" "1" "$(grep -c '^  restart-frontend)' "$SCRIPT")"
: > "$cp_log"
out="$(STUB_LOG="$cp_log" STUB_BACKEND_ID=stubbeef STUB_FRONTEND_ID=stubf00d \
  STUB_HOST_PORT=4001 STUB_BACKEND_ENV_PORT=4001 \
  PATH="$stubdir:$PATH" sh "$cm" restart-frontend 2>&1)"
assert_not_contains "restart-frontend never falls through to Unknown action" \
  "Unknown action: restart-frontend" "$out"
assert_contains "restart-frontend recreates the frontend container" \
  "ARG --force-recreate" "$(cat "$cp_log" 2>/dev/null)"

# General invariant: every action named in usage has a corresponding case arm.
# This is the assertion that would have caught the original restart-frontend
# defect.
usage_out="$(sh "$SCRIPT" help 2>&1)"
actions="$(printf '%s\n' "$usage_out" | sed -n 's/^  \([a-z][a-z-]*\).*/\1/p')"
assert_ne "usage advertises at least one action" "" "$actions"
missing=""
for _a in $actions; do
  if ! grep -q "^  ${_a})" "$SCRIPT"; then
    missing="$missing $_a"
  fi
done
if [ -z "$missing" ]; then
  pass "every action in usage has a case arm"
else
  fail "action(s) in usage with no case arm:$missing"
fi

# Case (T3): the help text carries no hardcoded default port.
assert_eq "help prints no hardcoded 4001" "0" "$(sh "$SCRIPT" help 2>&1 | grep -c 4001)"

# ---------------------------------------------------------------------------
printf '%s\n' "-----"
if [ "$failures" -eq 0 ]; then
  printf 'All %s assertions passed.\n' "$total"
  exit 0
fi
printf '%s of %s assertions FAILED.\n' "$failures" "$total"
exit 1
