# Fix plan — `project-tools/container-management.sh`

Found while implementing and verifying `project-tools/db-healthcheck.sh` (issue #16). The
healthcheck tool reads this script for connection conventions and deliberately does not
modify or depend on it. These defects were found there and are recorded here so they are
not lost.

**Nothing in this file has been fixed yet.** `container-management.sh` is unmodified.

- Target file: `project-tools/container-management.sh` (173 lines, `#!/usr/bin/env sh`)
- Environment the findings were observed on: Docker Compose v2, `docker compose ps`
- Date observed: 2026-10-05

---

## Findings

| # | Severity | Location | Summary |
|---|---|---|---|
| 1 | Real bug | `:32`, `:39` | `docker compose ps --filter name=backend` is rejected as `unknown filter name` |
| 2 | Real bug | `:32`, `:39` | `2>/dev/null` + empty `grep` makes a broken filter indistinguishable from a stopped container |
| 3 | Dead code | `:31-43` | `check_backend_running` and `check_frontend_network` are never called by any action |
| 4 | Smell | `:172-173`, `:28` | `help` exits 1; typos print full help instead of "unknown action" |
| 5 | Smell | `:38-43` | `check_frontend_network` never checks a frontend network; it re-runs the backend check |
| 6 | Smell | `:73`, `:123` | Hardcoded container name `02_rsc_wp_bun_vue_frontend` |
| 7 | Smell | `:72-73`, `:122-123` | `2>/dev/null \|\| true` hides genuine failures in `stop-all` / `remove-all` |

### Evidence for #1 and #2

```console
$ docker compose -f _01_rsc_wpm_backend/docker-compose.yml ps --filter name=backend --format '{{.Status}}'
unknown filter name
$ echo $?
1
```

`docker compose ps` has no `name` filter — that is `docker ps`. Compose rejects it. Because
stderr goes to `/dev/null`, the message never reaches the user, and `grep -q "Up"` then sees
empty input and also exits 1. The caller cannot tell "my flag is wrong" from "your container
is down", so it reports the wrong cause.

### Deliberate design — do not "fix" this

`:98-101` refuses to stop containers when stdin is not a TTY. That is **correct**: the action
stops every container in the Docker context, including other projects, and `:97` says so.
No task below changes this behaviour. It is also why that path cannot be exercised
non-interactively.

---

## Tasks

### T1 — Replace the invalid `--filter` with the positional service form

**Why:** `--filter name=` is not a `docker compose ps` option; every call using it fails.
**Where:** `project-tools/container-management.sh:32` and `:39`

Replace both occurrences of:

```sh
docker compose -f "$BACKEND_COMPOSE" ps --filter name=backend --format '{{.Status}}'
```

with:

```sh
docker compose -f "$BACKEND_COMPOSE" ps backend --format '{{.Status}}'
```

**Done when:** `docker compose -f "$BACKEND_COMPOSE" ps backend --format '{{.Status}}'` prints a
status containing `Up` and exits 0 while the backend is running, and prints nothing and exits
0 when it is not.

### T2 — Stop collapsing a tool error into "not running"

**Why:** an invalid flag, a missing compose file, and a genuine stopped container currently
produce the identical message. A wrong diagnosis sends the operator to restart something that
was already healthy.
**Where:** `container-management.sh:31-36` and `:38-43`

Rewrite both guard functions so the compose exit status is inspected separately from its
output. Required behaviour:

1. Capture stdout **and** stderr, and keep the compose exit status.
2. If compose exited non-zero, print the captured error verbatim and return 1 with a message
   that names the failure as a compose failure — not as the container being down.
3. Only when compose succeeded and the output is empty, report "no container matches service".
4. Only when compose succeeded and the output does not contain `Up`, report "not running".

Keep the actionable hint (`Run '<script> start-all' first.`) on the genuinely-down path only.

**Done when:** these four cases are distinguishable in the output and the exit codes hold:

| Scenario | Expected message | Exit |
|---|---|---|
| Backend running | `Status: Up ...` | 0 |
| Backend stopped | `Backend not running` | 1 |
| `COMPOSE_FILE` pointed at a missing path | names the missing file, not "not running" | 1 |
| Compose invoked with an invalid flag | prints compose's own error | 1 |

Verify the last two by temporarily pointing the script at a non-existent compose path.

### T3 — Make `help` succeed and unknown actions say so

**Why:** `help|*) usage` sends both a valid request and a typo down one path, and `usage()`
ends `exit 1`. So `./container-management.sh help` returns non-zero for a successful request,
and `./container-management.sh start-al` prints the whole help text instead of naming the bad
action. It also breaks the common `script help && echo ok` idiom.
**Where:** `container-management.sh:15-29` and `:172-173`

1. Give `usage()` a parameter for its exit code, e.g. `usage 0` for help and `usage 1` for
   misuse, defaulting to 1 so existing internal callers are unchanged.
2. Split the dispatcher tail into an explicit `help)` case that calls `usage 0`, and a `*)`
   case that prints `Unknown action: <action>` plus a one-line hint, then exits 1.

**Done when:**

```console
$ ./project-tools/container-management.sh help >/dev/null; echo $?
0
$ ./project-tools/container-management.sh start-al
Unknown action: start-al
$ echo $?
1
```

### T4 — Resolve the dead guard functions

**Why:** `check_backend_running` and `check_frontend_network` are defined but never called, so
findings #1 and #2 have no runtime effect today. They are a trap: the first person to wire
one in inherits a function that misreports the cause of failure.
**Where:** `container-management.sh:31-43`

Pick one and record the choice in the commit message:

- **Option A — wire them up.** Call `check_backend_running` from `test-frontend`, which needs
  the backend at `4001` to pass, and from `stop-all`. Call `check_frontend_network` from
  `start-all` before launching the frontend.
- **Option B — delete them.** If no action needs a precondition check, remove both. Lower risk
  and removes the trap outright.

Option A is preferred only if a caller genuinely needs the guard. Otherwise take Option B.

**Done when:** `grep -n 'check_backend_running\|check_frontend_network' container-management.sh`
returns only the definition line for each (Option B), or a call site plus a test that proves
the guard fires (Option A). No function exists that is defined and never called.

### T5 — Fix or delete `check_frontend_network`

**Why:** the name promises a frontend network check; the body re-checks the backend container.
Anyone trusting the name trusts behaviour that does not exist.
**Where:** `container-management.sh:38-43`

Follows from T4. If Option A, make it actually verify the shared network:

```sh
docker network inspect rsc-shared
```

and fail when the network is absent. If Option B, it is deleted along with its sibling.

**Done when:** either the function inspects the frontend network, or it no longer exists.

### T6 — Remove the hardcoded frontend container name

**Why:** `02_rsc_wp_bun_vue_frontend` is hardcoded at `:73` and `:123`, but Compose derives
container names from the project directory. Renaming the directory or the project silently
breaks `stop-all` and `remove-all`.
**Where:** `container-management.sh:73`, `:123`, and the `docker run` fallbacks at `:58-62`
and `:135-140`

1. Define `FRONTEND_CONTAINER` once near the existing compose path variables at the top.
2. Derive it where practical, for example
   `FRONTEND_CONTAINER="$(docker compose -f "$FRONTEND_COMPOSE" ps -q frontend)"`, falling back
   to the literal name when no container exists yet.
3. Replace all four literal occurrences with the variable.

**Done when:** `grep -c '02_rsc_wp_bun_vue_frontend' container-management.sh` returns 1 (the
single definition), and `stop-all` still stops the frontend.

### T7 — Distinguish real failures in `stop-all` and `remove-all`

**Why:** `2>/dev/null || true` discards the error, so a permission failure or an unreachable
daemon prints `=== Done ===` exactly like a clean success.
**Where:** `container-management.sh:72-73`, `:122-123`

1. Keep idempotency — stopping an already-stopped container must still succeed.
2. Capture output and exit status; when the container is absent, stay silent.
3. When the command fails for any other reason, print the captured error and return non-zero.
4. Do not print `=== Done ===` unless every step succeeded.

**Done when:** with the frontend container already stopped, `stop-all` still exits 0 silently;
with an invalid container name injected, it prints the docker error and exits non-zero.

### T8 — Add a regression test that fails on the original bug

**Why:** findings #1 and #2 shipped because nothing asserted the difference between "compose
errored" and "container stopped". Without a test, T2 regresses on the next refactor.
**Where:** new file, suggested path `project-tools/tests/container-management.test.sh`

Model it on the harness used for the healthcheck script: a plain `sh` script that runs cases
and prints `ok` / `FAIL` per assertion, exiting non-zero if any fail.

Required cases, in priority order:

1. **Guard distinguishes a compose error from a stopped container.** Point the script at a
   missing compose file; assert the output contains the file name and does **not** contain
   `not running`.
2. **Guard does not use `--filter name=`.** Assert no `docker compose ps` invocation in the
   script passes `--filter`; the test fails on the original code.
3. **`help` exits 0.**
4. **Unknown action prints `Unknown action` and exits 1.**
5. **`stop-running-containers` refuses non-TTY input** and stops nothing. This locks in the
   deliberate guard from the findings section so a later "cleanup" cannot remove it.

**Done when:** running the harness passes all cases, and reverting T1 or T2 makes case 1 or
case 2 fail. Confirm that by re-introducing the bug locally, watching it fail, then reverting.

---

## Order

1. **T1, T2, T3** — these are the real defects and are independent of each other. Do them first.
2. **T4, T5** — one decision, applied together; resolves the dead code and the misnamed function.
3. **T6, T7** — hygiene, no runtime impact today.
4. **T8** — last, so it covers the final state of everything above.

## Out of scope

- `stop-running-containers` non-TTY refusal (`:98-101`) — correct as written, leave it.
- The `docker run --network rsc-shared` fallback paths — they work; changing them is unrelated.
- The inline development credentials in the backend Compose file — already tracked separately in
  `TODO.md` under "Externalize and rotate database credentials".
- Any change to `project-tools/db-healthcheck.sh`, which is independent and must keep a zero diff
  against `container-management.sh`.

## Verification before closing

```sh
sh -n project-tools/container-management.sh          # syntax
sh project-tools/tests/container-management.test.sh   # regression harness
./project-tools/container-management.sh help; echo $? # expect 0
./project-tools/container-management.sh start-al     # expect Unknown action, exit 1
./project-tools/container-management.sh test-backend  # expect the existing suite to still pass
./project-tools/container-management.sh test-frontend # expect the existing suite to still pass
```

The last two matter most: the fix must not regress the suites that currently pass
(16/16 backend, 11/11 frontend).
