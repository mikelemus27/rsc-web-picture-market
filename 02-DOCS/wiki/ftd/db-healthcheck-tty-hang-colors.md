# Fix db-healthcheck TTY hang and raw ANSI escapes

## Intent

`project-tools/db-healthcheck.sh` hangs forever after the `health` check when it is run from
an interactive terminal, and the `[ PASS ]` lines print the literal text `\033[0;32m` instead
of real colors. Root causes and the minimal fix are recorded here so the change can be verified
against observed proof, not intention. Tracks GitHub issue #31.

## Scope

- `project-tools/db-healthcheck.sh` only.
- Two defects in the same file:
  1. `run_guarded()` + `docker compose exec` under a TTY stdin: the GNU `timeout` wrapper puts
     the command in a background process group, `compose exec` reads the TTY and is stopped by
     SIGTTIN, the pending SIGTERM cannot kill a stopped process, and the command substitution
     pipe never closes → infinite hang at `pg_ready` (and any later `sql_value` check).
  2. `setup_colors()` stores single-quoted `\033…` strings (9 text characters, not the ESC
     byte) and `run_check()` prints them with `printf '%s'`, which does not interpret backslash
     escapes in arguments → literal `\033[0;32m` in output. (`fail()`/`print_summary` use
     `echo -e`, which interprets — the reason the summary was the only colored part.)
- Not in scope: the dead `sql_display()` helper (defined, never called — see Next step).

## Checklist

- [x] Issue #31 created (rule: no branch without an associated issue).
- [x] Branch `fix/dev-db-healthcheck-tty-hang-colors` cut from `origin/dev` (clean tree).
- [x] Fix 1: detach stdin with `</dev/null` on the live `compose exec` check paths —
      `check_pg_ready` and `sql_value` (same pattern `run_query` already uses). The inner
      `timeout 10` guard stays intact for genuinely unresponsive databases.
- [x] Fix 2: define colors with ANSI-C quoting (`$'\033[0;31m'`) so `printf '%s'` in
      `run_check` emits the real ESC byte; `echo -e` paths keep working unchanged.
- [x] Full suite completes under a TTY, no hang, 8/8 PASS, exit 0.
- [x] No literal `\033` text in output; ESC bytes real (color works).
- [x] Non-TTY invocation still strips colors and passes 8/8.
- [x] Mutation proofs (scratch copies, reverted seds, discarded): reverting fix 2 alone
      → 8× literal `\033[0;32m` (exit 0); reverting fix 1 alone → `pg_ready` consumes the
      whole 10 s inner timeout with no output and FAILs (7/8).

## Evidence

Terminal-level isolation of the hang (before the fix, under `script -qec …` pty):

| Run | Result |
| --- | --- |
| `timeout 10 docker compose … exec -T postgres pg_isready …` (stdin = pty) inside `$(…)` | hangs; killed only by an outer timeout |
| same command without `timeout` | instant, RC 0 |
| same command with `timeout` but stdin `/dev/null` | instant, RC 0 |

Color defect (before the fix): `printf '%s' "$GREEN"` → `od -c` shows
`\ \ 0 3 3 [ 0 ; 3 2 m` (backslash text), while `printf '%b' "$GREEN"` shows `033 [` (ESC).

After the fix (this change):

- `timeout 40 script -qec -- ./project-tools/db-healthcheck.sh /dev/null` →
  all 8 checks PASS in ~3.5s, exit 0, no literal `\033` text; ESC bytes present
  (grep for the ESC byte > 0, grep for the literal `\033[` text = 0).
- `./project-tools/db-healthcheck.sh < /dev/null` (non-TTY) → 8/8 PASS, exit 0, no ESC bytes.
- `bash -n project-tools/db-healthcheck.sh` → no syntax errors (the script requires bash:
  `#!/usr/bin/env bash`, `set -o pipefail`, and now ANSI-C quoting; plain `sh`/`dash` is not a
  valid interpreter for it).

## Next step

- Add `sql_display()` to the dead-code cleanup backlog: defined at line 181, never called by
  any live path (grep shows only the definition). Removing it is a separate, docs-consolidation
  concern per the repo's dead-code policy; optionally fold into a future cleanup PR.