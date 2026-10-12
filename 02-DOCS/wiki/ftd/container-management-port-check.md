# container-management port drift check

## Intent

Issue #50. `project-tools/container-management.sh` already propagates the backend port from a
single source — the root `./.env` `PORT`, exported at line 26-27 and interpolated by both Compose
files — but nothing detects a **running** container that is stale relative to that source, and the
script still contradicts itself in two places. This change adds detection and makes the script
stop lying about itself.

Detection is read-only by design. A `sync-ports` action that *writes* the port somewhere would
create a second copy that drifts whenever the root `.env` is edited without re-running it — the
same failure mode that broke `test-frontend` before PR #49. A check cannot drift; a writer can.

## Scope

In — exactly five tasks:

- **T1** `check-ports`: a read-only action reporting the port it would use, what the running backend
  container actually publishes on the host and has in its environment, and the frontend container's
  `PORT` when one exists. On any mismatch it prints the exact recreate command and exits non-zero.
- **T2** `restart-frontend`: advertised in `usage` but with no `case` arm, so it falls through to the
  catch-all and prints `Unknown action: restart-frontend`. Implement it as "recreate the frontend
  container against the running backend".
- **T3** Remove the misleading hardcoded `4001` from the help text and comments: the port is
  configurable, so those strings are false whenever `PORT` is not `4001`. **Already satisfied at the
  base:** `022093c` (PR #49) had already changed all three strings to `${PORT}` before this change
  started, so T3 needed no edit here. The evidence below records that, together with the three
  `4001` occurrences that remain by design.
- **T4** Harness cases in `project-tools/tests/container-management.test.sh` covering T1, T2 and T3,
  including a **read-only guarantee** that fails if T1 ever reaches a mutating docker verb.
- **T5** Record the observed evidence here and close the `TODO.md` item.

Out:

- Any `sync-ports` writer, and any pre-sync step wired into `rebuild-all`: `rebuild-all` already ends
  in `up -d --force-recreate` for both services, which already re-reads the interpolation, so a
  pre-sync would encode a dependency between the build and the port that does not exist.
- A per-invocation `--port` flag: that is a third way in rather than a source of truth, and `API_URL`
  already covers the override case.
- `_01_rsc_wpm_backend/` and `_02_rsc_wp_frontend/` Compose files: port propagation there is done and
  merged (PR #49, `e4e6ceb`).

## Design — the `check-ports` contract

| Situation | Output | Exit |
| --- | --- | --- |
| Source port read (root `.env`), or the `4001` fallback when the file is absent | the port and which of the two it is | — |
| Backend running; published host port **and** env `PORT` both equal the source | a match line per value | **0** |
| Backend running; either of those values differs | both values side by side, a `mismatch` line, and the exact recreate command | **1** |
| A frontend container exists and its `PORT` differs from the source | a `mismatch` line naming the frontend value, plus the recreate command | **1** |
| A frontend container exists and its `PORT` matches | a match line for it | **0** |
| No backend container exists | "nothing running to check" | **0** |
| No frontend container exists | a "nothing to compare" note — **not** drift | **0** |
| Docker unreachable, or compose fails | docker's own error, reported as a tool failure — never as "not running" | **1** |

**Read-only is the contract.** `check-ports` must not write a file, and must not reach `up`, `run`,
`rm`, `create`, `start`, `stop`, `restart`, `build` or `rmi`. Only inspection verbs: `compose ps`,
`inspect`, `port`, `docker ps`.

**Recreate, never rebuild.** The port is read from the environment at runtime and is never baked into
an image at build time, so the remedy is `docker compose up -d --force-recreate` (about a second),
not `build --no-cache` (minutes). The message must say so, or the team learns to distrust it.

**The frontend is a one-shot job** whose `CMD` is the API suite, so it exits by design. A missing
frontend container is therefore **not** drift; when one exists, its `PORT` is reported and compared
too.

## Checklist

- [x] T1 `check-ports` exists, is listed in `usage`, and follows the contract table above.
      **proof:** the full table reproduced, each row with its exit code.
- [x] T2 `restart-frontend` has a real `case` arm and no longer prints `Unknown action`.
      **proof:** `sh project-tools/container-management.sh restart-frontend` recreates the frontend
      and `verify_stack` reports it; the string never appears in the output.
- [x] T3 the misleading hardcoded `4001` is gone from the help text and from the two comments that
      named the configured port.
      **proof:** `sh project-tools/container-management.sh help | grep -c 4001` → `0`, and those
      three strings were already `${PORT}` at the base. The three `4001` occurrences that remain are
      the fallback pair plus the new `docker port` format example — none of them asserts the
      configured port; the evidence below names the exact lines.
- [x] T4 harness cases added and **RED first**: the new assertions fail against the pre-change
      script and pass against the changed one.
      **proof:** `sh project-tools/tests/container-management.test.sh <pre-change script>` exits
      non-zero naming the new cases; against the changed script it exits 0.
- [x] Read-only guarantee: with a stub `docker` on `PATH` logging every invocation, `check-ports`
      reaches only inspection verbs on **both** the match path and the mismatch path.
      **proof:** the captured stub log contains no mutating verb on either path, and the gate is
      proven to have teeth — injecting `docker compose … up -d --force-recreate` into the mismatch
      branch makes it fail, naming `up`.
- [x] T5 `TODO.md` item closed with evidence, and this document records the observed results.

## Evidence

Observed on 2026-10-12, branch `feat/dev-port-drift-check` (base `dev` @ `e4e6ceb`), with the live
stack up (backend `01_rsc_wpm_bun_psgres-backend` publishing `4001`, root `.env` `PORT=4001`).

**T1 — the contract table, each row with its exit code.** Rows 2-5 are driven by the harness'
stub `docker` (deterministic), row 3 by the live stack.

| Situation | Observed output | Exit |
| --- | --- | --- |
| Source read (root `.env`) | `source PORT: 4001 (from <repo>/.env)` | — |
| Backend host port **and** env `PORT` equal the source | `backend published host port: 4001 (matches source)` + `backend environment PORT: 4001 (matches source)` | **0** |
| Either value differs | `mismatch: backend environment PORT is 5055, source is 4001` + `docker compose up -d --force-recreate` | **1** |
| No backend container exists | `backend: nothing running to check.` | **0** |
| Docker/compose failure | `stub: compose ps failed` + `docker compose failed while locating the backend (exit 1)`; the words "not running" never appear | **1** |

Live run before the recreate: the backend matched, but the frontend container (created before PR
#49) had no `PORT` env → `mismatch: frontend environment PORT is <none>, source is 4001` → exit 1.
After `restart-frontend` the same command returned `frontend environment PORT: 4001 (matches
source)` and `✅ no drift` → exit 0. So the live stack reproduced both row 3 and row 2.

**T2 — `restart-frontend`.** `sh project-tools/container-management.sh restart-frontend` → exit 0,
`backend: running`, `frontend: exited 0 (its CMD is the frontend test suite)`; the string
`Unknown action: restart-frontend` never appeared. The harness additionally runs it under the stub
`docker` and asserts the log contains `ARG --force-recreate`.

**T3 — no misleading hardcoded port in help/comments.** `sh project-tools/container-management.sh
help | grep -c 4001` → `0`. Note: the three historical strings (the `restart-frontend` usage line,
the comment above `check_backend_running`, the `test-frontend` comment) were already changed to
`${PORT}` by commit `022093c` (PR #49), so no further edit was needed here. `grep -c 4001
project-tools/container-management.sh` → `3`, and all three are by design: the fallback commentary
(line 26) and the fallback constant (line 32) in the port block, which the single-source rule
requires, plus the `docker port` output-shape example added by this change (line 239, e.g.
`4001/tcp -> 0.0.0.0:4001`) — an illustration of the format, not a claim about the configured port.
Only the first two predate this change.

**T4 — RED first, then green.** The pre-change script was saved with
`git show HEAD:project-tools/container-management.sh > /tmp/opencode/cm-pre.sh`.
`sh project-tools/tests/container-management.test.sh /tmp/opencode/cm-pre.sh` → **16 of 40
assertions FAILED**, exit 1, naming the new cases (14, 15, 16, 17, 20, 21, 24, 25, 27, 30, 31, 33,
35, 36, 37, 39). Against the changed script the same harness → **All 40 assertions passed**, exit 0
(the 13 pre-existing assertions stayed green). The general invariant (`every action named in usage
has a case arm`) is what failed as assertion 39 pre-change, naming `restart-frontend`.

**T4 — read-only guarantee, on both paths.** In the harness the stub `docker` logs every argv element
as an `ARG <element>` line. For the `check-ports` match probe (run with a frontend container present,
so the frontend's read path executes too) and again for the mismatch probe, the log contains `ARG
inspect`, `ARG port` and `docker compose … ps`, and no line equal to `up`, `run`, `rm`, `create`,
`start`, `stop`, `restart`, `build`, `rmi` or `exec`; and the copied `project-tools/` tree hashed
(`cksum`) identical before and after. Mutating verbs are asserted as whole argv elements, so a file
path containing e.g. "run" cannot produce a false pass or fail.

**T4 — the read-only gate is proven to have teeth.** A gate that cannot fail is theatre. Injecting the
exact regression it exists to catch — `docker compose -f "$BACKEND_COMPOSE" up -d --force-recreate`
added to the mismatch branch, i.e. `check-ports` "helpfully" repairing what it found — makes the
harness fail: `FAIL 23 - check-ports reached mutating docker verb(s) (mismatch path): up`, **1 of 40
assertions FAILED**, exit 1. The mutated copy was a throwaway under `/tmp/opencode`; the real script
was never touched.

**T5 — records.** `TODO.md` carries a completed issue #50 item with the evidence above.
