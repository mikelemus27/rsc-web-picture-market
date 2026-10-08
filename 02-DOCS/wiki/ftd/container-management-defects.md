# container-management defects

## Intent

Close the 8 tasks in `FIX_TODO_ContainerManagement_05102026_1.md`: seven findings (two real bugs,
three smells, two dead-code traps) plus the missing regression harness that would have caught
them. The script currently tells lies about *why* something failed — a bad flag, a missing compose
file and a genuinely stopped container all produce the same message — and two of its actions
report `=== Done ===` while discarding the error.

## Scope

In — exactly the eight tasks of the fix plan:

- **T1** replace the invalid `docker compose ps --filter name=` with the positional service form.
- **T2** rewrite the two guards so a compose failure, an absent container and a stopped container
  are three different messages with the compose status preserved.
- **T3** `help` exits 0; an unknown action prints `Unknown action: <action>` and exits 1.
- **T4/T5** resolve the dead `check_backend_running` / `check_frontend_network` pair and the
  misnamed function (decision recorded in the commit message).
- **T6** one `FRONTEND_CONTAINER` definition, used everywhere the literal appeared.
- **T7** `stop-all` / `remove-all` stay idempotent but stop hiding failures behind `|| true`,
  and `=== Done ===` only prints when every step succeeded.
- **T8** new `project-tools/tests/container-management.test.sh` that prints `ok`/`FAIL` per
  assertion, exits non-zero on any failure, and fails when T1 or T2 is reverted.

Deltas since the fix plan was written (it describes the file **before** PR #24, 173 lines):

- The `docker run --network rsc-shared` fallbacks listed as "out of scope — they work" were in
  fact the bug fixed by PR #24; the network is now `01_rsc_wpm_backend_rsc-network` and the
  guard functions were left untouched by that PR. T4/T5 must not reintroduce `rsc-shared`.
- T5's example `docker network inspect rsc-shared` is therefore stale: if that option is chosen,
  the network name must be `$FRONTEND_NETWORK`.
- The literal `02_rsc_wp_bun_vue_frontend` now appears more often than the two places the plan
  lists (PR #24 added it to the fallback `docker run --name` and to `verify_stack`'s inspection
  fallback), so T6's "grep returns 1" criterion applies to the current file, not the old one.

Out (unchanged from the fix plan, re-confirmed):

- The non-TTY refusal in `stop-running-containers` — correct by design, locked in as harness case 5.
- Inline credentials in the backend Compose file — tracked separately in `TODO.md`.
- `project-tools/db-healthcheck.sh` — must keep a zero diff.
- `start-all`/`rebuild-all` behaviour fixed by PR #24; this change does not alter them.

## Checklist

- [x] T1 `compose ps --filter name=` → positional service form → **proof:** the command prints a
      status containing `Up` and exits 0 with the backend up, prints nothing and exits 0 when it
      is down; `grep -c -- '--filter' project-tools/container-management.sh` → 0.
- [x] T2 guards distinguish four cases (running / stopped / missing compose file / bad flag) →
      **proof:** the four rows of the plan's table reproduced with their expected messages and
      exit codes.
- [x] T3 `help` exits 0 and `start-al` prints `Unknown action: start-al` with exit 1 →
      **proof:** `... help >/dev/null; echo $?` → `0`, `... start-al; echo $?` → `1`.
- [x] T4/T5 dead-guard decision applied and recorded → **proof:** `grep -n
      'check_backend_running\|check_frontend_network'` shows only definitions (Option B) or a
      call site **and** a passing harness case (Option A); no defined-and-never-called function.
- [x] T6 single `FRONTEND_CONTAINER` definition → **proof:** `grep -c '02_rsc_wp_bun_vue_frontend'`
      → 1, and `stop-all` still stops the frontend (observed in `docker ps -a` before/after).
- [x] T7 idempotent but honest `stop-all` → **proof:** already-stopped frontend → exit 0 silent;
      injected invalid container name → docker's own error and non-zero exit; no `=== Done ===`
      on failure.
- [x] T8 harness exists and is meaningful → **proof:** all cases `ok` and exit 0; reverting T1 or
      T2 locally makes case 1 or case 2 print `FAIL` (observed, then reverted).
- [x] Final verification → **proof:** `sh -n`, harness, `help`→0, unknown→1, and the app suites
      `test-backend` 16/16 and `test-frontend` 11/11 still pass.

## Evidence

Recorded 2026-10-08 on branch `fix/dev-container-management-defects` (base `133668d`),
Docker 29.7.2, Compose v5.5.1, `/bin/sh` = dash.

**T1** — `docker compose -f _01_rsc_wpm_backend/docker-compose.yml ps backend --format '{{.Status}}'`
→ `Up 2 minutes`, exit 0. Down case (exited frontend): same command prints nothing, exit 0.
`grep -c -- '--filter' project-tools/container-management.sh` → `0`.

**T2** — four rows, all observed:

| Scenario | Observed message | Exit |
|---|---|---|
| Backend running (`test-frontend`) | `Status: Up 13 hours` (later `Status: Up About a minute`) | 0 |
| Backend stopped (service stopped temporarily, then restored) | `❌ Backend not running. Run 'project-tools/container-management.sh start-all' first.` | 1 |
| Compose path missing (copy under `/tmp/opencode/t2-missing`) | `compose file "/tmp/opencode/t2-missing/_01_rsc_wpm_backend/docker-compose.yml" is invalid: open ...: no such file or directory` + `❌ docker compose failed while checking the backend (exit 1).` — no "not running" | 1 |
| Malformed YAML (copy under `/tmp/opencode/t2-badyaml`) | compose's own error verbatim: `go-yaml load error in parser (while parsing a flow sequence) at L3.C11-L4.C1: ...` | 1 |

The guard inspects the compose exit status separately from its output and uses `ps --all backend`
so a genuinely stopped backend yields `Exited ...` → the "not running" row, while an absent
container (empty output, exit 0) yields "No container matches service".

**T3** — `sh project-tools/container-management.sh help >/dev/null; echo $?` → `0`.
`sh project-tools/container-management.sh start-al` → `Unknown action: start-al` + one-line hint,
exit `1`. (A no-argument invocation still prints the full help with exit 1, as before.)

**T4/T5** — Option A for `check_backend_running` (wired into `test-frontend` only — not
`stop-all`, which would break idempotency, and not `start-all`, which already runs
`verify_stack`); Option B for `check_frontend_network` — deleted. `grep -n
'check_backend_running\|check_frontend_network'` shows exactly `49:check_backend_running() {`
(definition) and `308:    check_backend_running` (call site). Harness case 6 locks this in; the
guard firing at the call site is proven by harness case 1.

**T6** — `grep -c '02_rsc_wp_bun_vue_frontend'` → `1` (the `FRONTEND_CONTAINER` definition).
`stop-all` before/after via `docker ps -a`: backend and postgres went `Up` → `Exited`, and
`stop-all` printed `02_rsc_wp_bun_vue_frontend` (the variable reaching `docker stop`).
Restored with `start-all`, all three containers back.

**T7** — idempotency: with everything already stopped, `stop-all` exits `0` with no error
(frontend was already `Exited (0)`). Honesty: in a `/tmp/opencode/t7-probe` copy (isolated
`COMPOSE_PROJECT_NAME`), `FRONTEND_CONTAINER="-bogus_frontend"` → `stop-all` prints docker's own
`unknown shorthand flag: 'b' in -bogus_frontend` and exits 1; `remove-all` prints docker's own
error, exits 1 and does **not** print `=== Done ===`. A valid-but-absent name
(`bogus_frontend_absent_xyz`) stays silent with exit 0 on both actions — the spec's "when the
container is absent, stay silent" row; `docker rm -f` is natively idempotent on Docker 29
(exit 0, no output), `docker stop` is not (exit 1, `No such container`), which is what the
`"No such container"` carve-out in `stop_named_container` neutralises.

**T8** — `sh project-tools/tests/container-management.test.sh` → 13/13 `ok`, exit 0. Mutation
proofs (copies under `/tmp/opencode`, discarded afterwards):

- T1 revert (`ps --filter name=backend` reintroduced): assertions 1 and 4 print `FAIL`, exit 1.
- T2 revert (original `2>/dev/null | grep -q "Up"` collapsing logic): assertions 1 and 2 print
  `FAIL` (output claims `not running`, names no compose file), exit 1.

**Final gate** — `sh -n` → 0; harness → 0; `help` → 0; `start-al` → 1;
`test-backend` → `16 pass, 0 fail` (exit 0); `test-frontend` → `Status: Up ...` then
`11 pass, 0 fail` (exit 0). Stack left healthy: backend `Up`, postgres `Up (healthy)`,
frontend one-shot container present (`Exited (0)`).

## Next

Implement T1–T3 first (independent real defects), then T4/T5, T6/T7, and T8 last so it covers the
final state. Record each observed result here as it is checked.
