#!/usr/bin/env bash
# Validates .github/labels.yml as data, independently of applying it.
#
# This does not touch GitHub. The apply step lives in
# .github/workflows/sync-labels.yml. Keeping them apart means a broken
# workflow can be proven wrong without mutating the repository's labels.
#
# Run locally:  .github/scripts/validate-labels.sh
# Prove the checks can fail:  .github/scripts/validate-labels.sh --self-test

set -euo pipefail

LABELS_FILE="${LABELS_FILE:-.github/labels.yml}"
MAX_DESCRIPTION_LENGTH=100

failures=0

fail() {
  printf '  ✗ %s\n' "$1" >&2
  failures=$((failures + 1))
}

pass() {
  printf '  ✓ %s\n' "$1"
}

require() {
  command -v "$1" >/dev/null 2>&1 || {
    printf 'error: %s is required but not installed\n' "$1" >&2
    exit 2
  }
}

# The transformation under test. This must stay byte-identical to the one
# in sync-labels.yml, because the risk being guarded is a disagreement
# between that invocation and the loop that consumes it.
emit_labels() {
  yq -o=json -I=0 '.labels[]' "$LABELS_FILE"
}

check_file_shape() {
  printf '\n[1/5] labels.yml parses as a sequence of labels\n'

  if [ "$(yq '.labels | type' "$LABELS_FILE")" != "!!seq" ]; then
    fail ".labels must be a sequence, got $(yq '.labels | type' "$LABELS_FILE")"
    return
  fi

  local declared
  declared="$(yq '.labels | length' "$LABELS_FILE")"

  if [ "$declared" -eq 0 ]; then
    fail '.labels is empty'
    return
  fi

  pass "$declared labels declared"
}

check_pipeline_emits_complete_objects() {
  printf '\n[2/5] every emitted line is one complete JSON object\n'

  local line count=0
  while read -r line; do
    count=$((count + 1))
    if ! printf '%s' "$line" | jq -e 'has("name") and has("color") and has("description")' >/dev/null 2>&1; then
      fail "line $count is not a complete label object (first 40 chars: ${line:0:40})"
      return
    fi
  done < <(emit_labels)

  pass "$count objects emitted, all parseable"
}

# The property that matters: nothing declared in the file may be lost or
# duplicated by the transformation. This compares the count the file
# declares against the count that actually survives, so it stays correct
# as labels are added or removed.
check_survival_invariant() {
  printf '\n[3/5] every declared label survives the transformation\n'

  local declared emitted
  declared="$(yq '.labels | length' "$LABELS_FILE")"
  emitted="$(emit_labels | grep -c .)"

  if [ "$declared" -ne "$emitted" ]; then
    fail "declared $declared labels but $emitted survived the transformation"
    return
  fi

  pass "$declared declared == $emitted emitted"
}

check_structure() {
  printf '\n[4/5] structural rules GitHub enforces\n'

  local bad_shape=0 bad_color=0 bad_description=0 duplicates
  local name color description normalized

  while IFS= read -r name; do
    color="$(yq ".labels[] | select(.name == \"$name\") | .color" "$LABELS_FILE")"
    description="$(yq ".labels[] | select(.name == \"$name\") | .description" "$LABELS_FILE")"
    normalized="$(printf '%s' "$description" | tr '\n' ' ' | tr -s ' ' | sed 's/^ //;s/ $//')"

    [ -z "$name" ] || [ -z "$color" ] || [ -z "$description" ] || [ "$description" = "null" ] \
      && { fail "label '${name:-<unnamed>}' is missing name, color, or description"; bad_shape=$((bad_shape + 1)); }

    if ! printf '%s' "$color" | grep -qE '^[0-9A-Fa-f]{6}$'; then
      fail "label '$name' has color '$color', expected 6 hex digits"
      bad_color=$((bad_color + 1))
    fi

    if [ "${#normalized}" -gt "$MAX_DESCRIPTION_LENGTH" ]; then
      fail "label '$name' description is ${#normalized} chars, GitHub's limit is $MAX_DESCRIPTION_LENGTH"
      bad_description=$((bad_description + 1))
    fi
  done < <(yq '.labels[].name' "$LABELS_FILE")

  duplicates="$(yq -r '[.labels[].name] | (. | length) as $total | (unique | length) as $unique | "\($total - $unique)"' "$LABELS_FILE")"
  if [ "$duplicates" -ne 0 ]; then
    fail "$duplicates duplicate label name(s)"
  fi

  [ "$bad_shape" -eq 0 ] && pass "every label has name, color, and description"
  [ "$bad_color" -eq 0 ] && pass "every color is 6 hex digits"
  [ "$bad_description" -eq 0 ] && pass "every description fits within $MAX_DESCRIPTION_LENGTH characters"
  [ "$duplicates" -eq 0 ] && pass "no duplicate label names"
}

# Proves the guard above actually guards. Without this, a green run only
# shows the checks did not object -- not that they would object.
check_validator_can_fail() {
  printf '\n[5/5] the pipeline check rejects the known-broken form\n'

  local broken detected=0
  # No pipe here on purpose. `yq ... | head -1` makes head close the pipe
  # early, yq dies of SIGPIPE, and set -o pipefail then kills this script
  # before it can report anything. Capturing first and slicing in bash keeps
  # the negative control from taking the validator down with it.
  local pretty
  pretty="$(yq -o=json '.labels[]' "$LABELS_FILE")"
  broken="${pretty%%$'\n'*}"

  if printf '%s' "$broken" | jq -e 'has("name") and has("color") and has("description")' >/dev/null 2>&1; then
    detected=1
  fi

  if [ "$detected" -eq 0 ]; then
    pass 'pretty-printed output is correctly rejected (the multiline bug cannot pass silently)'
    return
  fi

  fail 'pretty-printed output was accepted; this validator would not catch the multiline bug'
}

main() {
  require yq
  require jq

  printf 'validating %s\n' "$LABELS_FILE"

  check_file_shape
  check_pipeline_emits_complete_objects
  check_survival_invariant
  check_structure
  check_validator_can_fail

  printf '\n'
  if [ "$failures" -ne 0 ]; then
    printf '%d check(s) failed\n' "$failures" >&2
    exit 1
  fi

  printf 'all checks passed\n'
}

main "$@"