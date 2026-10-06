#!/usr/bin/env bash
#
# Proves that validate-labels.sh can actually fail.
#
# This is a mutation-testing harness for the label validator.
#
# It deliberately introduces known defects into isolated copies of:
#
#   - validate-labels.sh
#   - labels.yml
#
# and verifies that the validator:
#
#   1. accepts the pristine input;
#   2. rejects each injected fault;
#   3. rejects it for the expected reason;
#   4. can be restored exactly to the pristine state;
#   5. accepts the restored state again.
#
# Design constraints:
#
#   1. No negative case runs until the healthy baseline has passed.
#
#   2. Every mutation has an independent verification step.
#
#   3. Every fault must be detected for its intended reason, on a line the
#      validator marked as a failure. Matching the reason anywhere in the
#      output is not sufficient: the validator prints both
#      "✓ N duplicate label name(s)" and "✗ N duplicate label name(s)", so
#      a bare substring search is satisfied by the passing line.
#
#   4. Pristine state is captured before any mutation.
#
#   5. Restoration is verified using SHA-256, not merely by trusting cp.
#
#   6. All mutations happen inside a temporary directory.
#
#   7. No eval is used. Fault mutations and verification are ordinary
#      shell functions, so command construction is explicit and inspectable.
#
#   8. The harness itself must distinguish:
#
#        validator rejected bad input
#
#      from:
#
#        harness failed to perform or verify the intended test.
#
# Usage:
#
#   .github/scripts/test-validate-labels.sh
#
# Optional overrides:
#
#   VALIDATOR=.github/scripts/validate-labels.sh
#   LABELS_FILE=.github/labels.yml
#

set -uo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

VALIDATOR="${VALIDATOR:-.github/scripts/validate-labels.sh}"
LABELS_FILE="${LABELS_FILE:-.github/labels.yml}"

# ---------------------------------------------------------------------------
# Dependency checks
# ---------------------------------------------------------------------------

require_command() {
    local command_name="$1"

    if ! command -v "$command_name" >/dev/null 2>&1; then
        printf 'error: %s is required but not installed\n' "$command_name" >&2
        exit 2
    fi
}

require_command yq
require_command jq
require_command sha256sum
require_command mktemp
require_command sed
require_command grep
require_command cp

# ---------------------------------------------------------------------------
# Input checks
# ---------------------------------------------------------------------------

for file in "$VALIDATOR" "$LABELS_FILE"; do
    if [ ! -f "$file" ]; then
        printf 'error: %s not found\n' "$file" >&2
        exit 2
    fi
done

# ---------------------------------------------------------------------------
# Temporary workspace
# ---------------------------------------------------------------------------

WORK="$(mktemp -d)"

cleanup() {
    rm -rf "$WORK"
}

trap cleanup EXIT HUP INT TERM

PRISTINE_DIR="$WORK/pristine"

PRISTINE_VALIDATOR="$PRISTINE_DIR/validate-labels.sh"
PRISTINE_LABELS="$PRISTINE_DIR/labels.yml"

LIVE_VALIDATOR="$WORK/validate-labels.sh"
LIVE_LABELS="$WORK/labels.yml"

mkdir -p "$PRISTINE_DIR"

# ---------------------------------------------------------------------------
# Test state
# ---------------------------------------------------------------------------

faults_run=0
faults_caught=0
harness_errors=0

current_fault='<none>'

RUN_OUTPUT=''
RUN_EXIT=0

# ---------------------------------------------------------------------------
# Harness error reporting
# ---------------------------------------------------------------------------

abort_fault() {
    printf '  ⨯ HARNESS ERROR in %s: %s\n' \
        "$current_fault" \
        "$1" >&2

    harness_errors=$((harness_errors + 1))
}

# ---------------------------------------------------------------------------
# SHA-256 helpers
# ---------------------------------------------------------------------------

sha256_file() {
    sha256sum "$1" | cut -d' ' -f1
}

# ---------------------------------------------------------------------------
# Phase 1: capture pristine state
# ---------------------------------------------------------------------------

printf 'phase 1/6  CAPTURE    pristine state\n'

cp "$VALIDATOR" "$PRISTINE_VALIDATOR"
cp "$LABELS_FILE" "$PRISTINE_LABELS"

PRISTINE_VALIDATOR_SUM="$(sha256_file "$PRISTINE_VALIDATOR")"
PRISTINE_LABELS_SUM="$(sha256_file "$PRISTINE_LABELS")"

printf '            validator sha256 %s\n' \
    "${PRISTINE_VALIDATOR_SUM:0:16}"

printf '            labels    sha256 %s\n' \
    "${PRISTINE_LABELS_SUM:0:16}"

# ---------------------------------------------------------------------------
# Restore pristine state into the isolated live workspace.
# ---------------------------------------------------------------------------

restore_pristine() {
    cp "$PRISTINE_VALIDATOR" "$LIVE_VALIDATOR"
    cp "$PRISTINE_LABELS" "$LIVE_LABELS"
}

# ---------------------------------------------------------------------------
# Verify that restoration is byte-for-byte identical to pristine state.
# ---------------------------------------------------------------------------

restore_is_exact() {
    local validator_sum
    local labels_sum

    validator_sum="$(sha256_file "$LIVE_VALIDATOR")"
    labels_sum="$(sha256_file "$LIVE_LABELS")"

    [ "$validator_sum" = "$PRISTINE_VALIDATOR_SUM" ] &&
    [ "$labels_sum" = "$PRISTINE_LABELS_SUM" ]
}

# ---------------------------------------------------------------------------
# Run the validator against an isolated labels file.
#
# The validator itself is also the isolated copy.
# ---------------------------------------------------------------------------

run_validator() {
    RUN_OUTPUT="$(
        LABELS_FILE="$1" bash "$LIVE_VALIDATOR" 2>&1
    )"

    RUN_EXIT=$?
}

# ===========================================================================
# Phase 2: baseline
# ===========================================================================

printf '\nphase 2/6  BASELINE   healthy input must PASS\n'

restore_pristine

if ! restore_is_exact; then
    printf '  ⨯ could not establish pristine baseline checksums\n' >&2
    exit 1
fi

run_validator "$LIVE_LABELS"

if [ "$RUN_EXIT" -ne 0 ]; then
    printf '  ⨯ healthy input was rejected (exit %d):\n' \
        "$RUN_EXIT" >&2

    printf '%s\n' "$RUN_OUTPUT" |
        sed 's/^/      /' >&2

    printf '\nABORT: the baseline is not valid, so no negative case can be trusted.\n' >&2
    printf 'This harness will not report detections until the healthy path passes.\n' >&2

    exit 1
fi

printf '  ✓ exit 0 on healthy input\n'

PASS_COUNT="$(
    printf '%s' "$RUN_OUTPUT" |
        grep -c '✓' || true
)"

printf '  ✓ %s checks reported passing\n' "$PASS_COUNT"

# ===========================================================================
# Phase 3: mutation helpers
#
# Each fault has two explicit functions:
#
#   fault_N_mutate
#   fault_N_verify
#
# This deliberately avoids eval.
# ===========================================================================

# ---------------------------------------------------------------------------
# Fault 1
#
# Incident reproduced:
#
#   yq -o=json
#
# produces pretty-printed multi-line JSON. A line-oriented read loop then
# feeds incomplete fragments to jq.
#
# The production fix is:
#
#   yq -o=json -I=0
# ---------------------------------------------------------------------------

fault_1_mutate() {
    sed -i \
        's/-o=json -I=0/-o=json/' \
        "$LIVE_VALIDATOR"
}

fault_1_verify() {
    grep -q "yq -o=json '" "$LIVE_VALIDATOR" &&
    ! grep -q -- '-I=0' "$LIVE_VALIDATOR"
}

# ---------------------------------------------------------------------------
# Fault 2
#
# GitHub label descriptions have a maximum length of 100 characters.
# ---------------------------------------------------------------------------

fault_2_mutate() {
    yq -i \
        '.labels[0].description =
         ("Z" * 140) + " " + .labels[0].description' \
        "$LIVE_LABELS"
}

fault_2_verify() {
    local length

    length="$(
        yq '.labels[0].description | length' "$LIVE_LABELS"
    )"

    [ "$length" -gt 100 ]
}

# ---------------------------------------------------------------------------
# Fault 3
#
# GitHub label colors must be six hexadecimal digits.
# ---------------------------------------------------------------------------

fault_3_mutate() {
    yq -i \
        '.labels[0].color = "ZZZZZZ"' \
        "$LIVE_LABELS"
}

fault_3_verify() {
    [ "$(yq '.labels[0].color' "$LIVE_LABELS")" = 'ZZZZZZ' ]
}

# ---------------------------------------------------------------------------
# Fault 4
#
# Duplicate label name.
#
# The description is deliberately made short so that the description-length
# check cannot be the reason for the failure.
# ---------------------------------------------------------------------------

fault_4_mutate() {
    yq -i \
        '.labels[1].name = .labels[0].name |
         .labels[1].description = "Short."' \
        "$LIVE_LABELS"
}

fault_4_verify() {
    local duplicate_count

    duplicate_count="$(
        yq -r '
            [.labels[].name]
            | (length) as $total
            | (unique | length) as $unique
            | $total - $unique
        ' "$LIVE_LABELS"
    )"

    [ "$duplicate_count" -eq 1 ]
}

# ---------------------------------------------------------------------------
# Fault 5
#
# Remove the entire label sequence.
# ---------------------------------------------------------------------------

fault_5_mutate() {
    yq -i \
        '.labels = []' \
        "$LIVE_LABELS"
}

fault_5_verify() {
    [ "$(yq '.labels | length' "$LIVE_LABELS")" -eq 0 ]
}

# ---------------------------------------------------------------------------
# Fault 6
#
# Remove the name field from one label.
# ---------------------------------------------------------------------------

fault_6_mutate() {
    yq -i \
        'del(.labels[0].name)' \
        "$LIVE_LABELS"
}

fault_6_verify() {
    local missing_name_count

    missing_name_count="$(
        yq '
            [
                .labels[]
                | select(has("name") | not)
            ]
            | length
        ' "$LIVE_LABELS"
    )"

    [ "$missing_name_count" -ge 1 ]
}

# ---------------------------------------------------------------------------
# Fault 7
#
# Negative control.
#
# Disable the production protection that makes the multiline JSON bug
# detectable.
#
# This is intentionally different from a malformed labels.yml case.
#
# The purpose is to demonstrate that the test for Fault 1 has real teeth:
# if the validator is modified so that it no longer detects the multiline
# problem, this negative control must fail.
#
# An earlier attempt used:
#
#     yq | head -1
#
# to provoke SIGPIPE. That was rejected because it was nondeterministic:
#
#     8/10 runs crashed
#     2/10 runs did not
#
# A flaky mutation is unsuitable for CI.
# ---------------------------------------------------------------------------

fault_7_mutate() {
    sed -i \
        's|-o=json '\''\.labels\[\]'\'' "$LABELS_FILE"|-o=json -I=0 '\''.labels[]'\'' "$LABELS_FILE"|' \
        "$LIVE_VALIDATOR"
}

fault_7_verify() {
    grep -q \
        'yq -o=json -I=0' \
        "$LIVE_VALIDATOR"
}

# ===========================================================================
# Generic fault runner
#
# Arguments:
#
#   1. human-readable fault name
#   2. mutation function name
#   3. mutation verification function name
#   4. expected validator message
#
# No eval is required. Bash invokes the named functions directly.
# ===========================================================================

run_fault() {
    local name="$1"
    local mutate_function="$2"
    local verify_function="$3"
    local expected="$4"

    local failure_lines

    current_fault="$name"

    faults_run=$((faults_run + 1))

    printf '\n  [%d] %s\n' \
        "$faults_run" \
        "$name"

    # -----------------------------------------------------------------------
    # Restore pristine state before every fault.
    # -----------------------------------------------------------------------

    restore_pristine

    if ! restore_is_exact; then
        abort_fault \
            'restoration did not reproduce pristine checksums'

        return
    fi

    # -----------------------------------------------------------------------
    # Apply the mutation.
    # -----------------------------------------------------------------------

    if ! "$mutate_function"; then
        abort_fault \
            'mutation command failed'

        return
    fi

    # -----------------------------------------------------------------------
    # Prove that the mutation actually happened.
    # -----------------------------------------------------------------------

    if ! "$verify_function"; then
        abort_fault \
            'mutation did not take effect, so any failure would be meaningless'

        return
    fi

    printf '      mutation verified as applied\n'

    # -----------------------------------------------------------------------
    # Execute validator against mutated state.
    # -----------------------------------------------------------------------

    run_validator "$LIVE_LABELS"

    # -----------------------------------------------------------------------
    # A fault that the validator accepts is a real missed mutation.
    # -----------------------------------------------------------------------

    if [ "$RUN_EXIT" -eq 0 ]; then
        printf \
            '  ✗ NOT DETECTED: validator accepted broken input (exit 0)\n'

        return
    fi

    # -----------------------------------------------------------------------
    # Verify the reason.
    #
    # The sentinel is resolved before substring comparison.
    #
    # The expected message must appear on a line the validator marked as a
    # failure. Matching the whole output is not enough: validate-labels.sh
    # prints both "✓ N duplicate label name(s)" and "✗ N duplicate label
    # name(s)", so a bare substring search is satisfied by the passing line.
    # A neutered duplicate check therefore used to be reported as caught by
    # its own check while still exiting non-zero for an unrelated reason.
    #
    # The grep is split in two so the pipeline is not sensitive to pipefail
    # when the validator emits no failure line at all.
    # -----------------------------------------------------------------------

    failure_lines="$(
        printf '%s\n' "$RUN_OUTPUT" |
            grep -F '✗' ||
            true
    )"

    if [ "$expected" = '__NO_SUCCESS__' ]; then

        if printf '%s' "$RUN_OUTPUT" |
            grep -qF 'all checks passed'
        then
            printf \
                '  ✗ NOT DETECTED: validator reported success\n'

            return
        fi

        printf \
            '      caught as: exited %d without reporting success\n' \
            "$RUN_EXIT"

    else

        if ! printf '%s\n' "$failure_lines" |
            grep -qF "$expected"
        then
            printf \
                '  ✗ WRONG REASON: failed, but not with the expected message\n'

            printf \
                '      expected on a ✗ line: %s\n' \
                "$expected"

            printf '      failure lines emitted:\n'

            if [ -n "$failure_lines" ]; then
                printf '%s\n' "$failure_lines" |
                    sed 's/^/        /'
            else
                printf '        (none — the validator rejected the input\n'
                printf '         without printing any diagnostic marked ✗)\n'
            fi

            return
        fi

        printf \
            '      caught by its own check: %s\n' \
            "$expected"
    fi

    faults_caught=$((faults_caught + 1))
}

# ===========================================================================
# Execute mutation suite
# ===========================================================================

printf '\nphase 3/6  FAULTS     each must FAIL, for its own reason\n'

run_fault \
    'pipeline emits fragments (the -I=0 defect)' \
    fault_1_mutate \
    fault_1_verify \
    'is not a complete label object'

run_fault \
    'description exceeds GitHub 100 character limit' \
    fault_2_mutate \
    fault_2_verify \
    "GitHub's limit is 100"

run_fault \
    'color is not six hex digits' \
    fault_3_mutate \
    fault_3_verify \
    'expected 6 hex digits'

run_fault \
    'duplicate label name (short descriptions, so only duplicate check can fire)' \
    fault_4_mutate \
    fault_4_verify \
    'duplicate label name'

run_fault \
    'label sequence is empty' \
    fault_5_mutate \
    fault_5_verify \
    '.labels is empty'

run_fault \
    'label missing its name field' \
    fault_6_mutate \
    fault_6_verify \
    'is not a complete label object'

run_fault \
    'negative control disarmed (validator cannot notice multiline bug)' \
    fault_7_mutate \
    fault_7_verify \
    'would not catch the multiline bug'

# ===========================================================================
# Phase 4: restoration
# ===========================================================================

printf '\nphase 4/6  RESTORE    back to pristine, proven by checksum\n'

restore_pristine

if restore_is_exact; then
    printf '  ✓ both files match pristine checksums exactly\n'
else
    abort_fault \
        'restore did not reproduce pristine checksums'
fi

# ===========================================================================
# Phase 5: final healthy-path verification
# ===========================================================================

printf '\nphase 5/6  FINAL      restored input must PASS again\n'

run_validator "$LIVE_LABELS"

if [ "$RUN_EXIT" -eq 0 ]; then
    printf '  ✓ exit 0 after restoration\n'
else
    printf \
        '  ⨯ restored input was rejected (exit %d):\n' \
        "$RUN_EXIT" >&2

    printf '%s\n' "$RUN_OUTPUT" |
        sed 's/^/      /' >&2

    harness_errors=$((harness_errors + 1))
fi

# ===========================================================================
# Phase 6: verdict
# ===========================================================================

printf '\nphase 6/6  VERDICT\n'

printf '  faults run     %d\n' \
    "$faults_run"

printf '  faults caught  %d\n' \
    "$faults_caught"

printf '  harness errors %d\n' \
    "$harness_errors"

# ---------------------------------------------------------------------------
# A harness error means the test infrastructure itself could not establish
# trustworthy evidence.
# ---------------------------------------------------------------------------

if [ "$harness_errors" -ne 0 ]; then
    printf \
        '\nRESULT: harness error. The validator was not exercised as intended.\n' >&2

    exit 1
fi

# ---------------------------------------------------------------------------
# Every injected fault must have been detected.
# ---------------------------------------------------------------------------

if [ "$faults_caught" -ne "$faults_run" ]; then
    printf \
        '\nRESULT: validator missed a fault it should have caught.\n' >&2

    exit 1
fi

# ---------------------------------------------------------------------------
# Everything passed.
# ---------------------------------------------------------------------------

printf '\nRESULT: every fault was detected by its own check, and the healthy path\n'
printf 'passed before and after. The validator can fail, and fails for real reasons.\n'
