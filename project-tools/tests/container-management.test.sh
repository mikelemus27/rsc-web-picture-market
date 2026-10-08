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
printf '%s\n' "-----"
if [ "$failures" -eq 0 ]; then
  printf 'All %s assertions passed.\n' "$total"
  exit 0
fi
printf '%s of %s assertions FAILED.\n' "$failures" "$total"
exit 1
