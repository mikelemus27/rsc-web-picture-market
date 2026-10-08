# start-all reliability

## Intent

`start-all` and `rebuild-all` in `project-tools/container-management.sh` hide their own failures.
Every `build`/`up`/`run` is piped into `tail`, and a pipeline's exit status is the status of its
**last** command, so `docker compose build ... | tail -1` reports `tail`'s status (always 0) instead
of compose's. A failed build therefore falls through to the next step as if it had succeeded, the
frontend fallback never fires, and the user gets a green script and a broken stack.

The goal is one change: make these two actions tell the truth about what happened, align their
build/recreate behaviour between the two services, and verify the right things (the frontend is a
one-shot test job, not a daemon).

## Scope

In:

- Capture the real exit status of every `build`, `up`, and `run` in `start-all` and `rebuild-all`
  (no `... | tail` in the command position).
- Make the `docker run` fallback reachable, and give it the **same** network compose uses
  (`01_rsc_wpm_backend_rsc-network`, not the stale `rsc-shared`).
- Align build modes between backend and frontend (`rebuild-all` rebuilds both with `--no-cache`)
  and add `--force-recreate` so a container attached to a deleted network is rebuilt instead of
  failing with `network ... not found`.
- Fix the verification step: the frontend runs `CMD ["bun","test",...]`, exits 0, and is not
  `Up` — verification must not grep `docker ps` for a running frontend. Backend must be running;
  frontend is reported, not asserted as Up.
- Move the `TODO.md` item to Completed with observed evidence.
- Replace `echo -e` with `printf '%b\n'`: `/bin/sh` is dash here, dash's `echo` does not know the
  `-e` flag, so every colour line printed a literal `-e` in front of it (pre-existing, and the new
  lines would have shipped the same defect).

Out (tracked separately in `TODO.md`):

- The 8 defects in `container-management.sh` listed against `FIX_TODO_ContainerManagement_05102026_1.md`
  (invalid `--filter name=`, swallowed stderr, `help` exit status, unknown-action message, dead
  `check_backend_running`/`check_frontend_network`, hardcoded container names, `|| true` in
  stop/remove, missing `project-tools/tests/container-management.test.sh`).
- `docker rmi` before rebuild — rejected: it fails for in-use images and does not clear BuildKit's
  cache; the real levers are exit-status capture and `--no-cache`/`--pull` (Engram decision
  `architecture/docker-build-determinism`).
- The non-TTY refusal in `stop-running-containers`.
- Any change to the rotation feature (already merged in PR #23).

## Checklist

- [x] 1. Every `build`/`up`/`run` in `start-all` and `rebuild-all` reports its own status →
      **observed:** forced compose failure exits 1 and prints compose's own error; healthy run
      exits 0 (Evidence 1 and 5).
- [x] 2. Fallback uses the compose network `01_rsc_wpm_backend_rsc-network` →
      **observed:** `grep -n "rsc-shared"` matches only the comment on line 15 that explains why
      the old value was wrong; no code path references it (Evidence 2).
- [x] 3. Build modes aligned (`--no-cache` on both in `rebuild-all`) + `--force-recreate` →
      **observed:** both `build --no-cache` calls and both `up -d --force-recreate` calls are
      present; `start-all` keeps the cache for both services (fast path, same mode each) and
      forces only the frontend (Evidence 3).
- [x] 4. Verification does not assume the frontend stays running →
      **observed:** real `start-all` exits 0 while the frontend job is `running=false exit=0`;
      backend missing → exit 1; frontend exit 3 → exit 1 (Evidence 4, 5).
- [x] 5. `sh -n project-tools/container-management.sh` passes → **observed:** exit 0.
- [x] 6. `TODO.md` start-all item checked with the observed evidence →
      **observed:** item moved to `## Completed` with the recorded results.
- [x] 7. Colour output carries no stray `-e` under dash →
      **observed:** 14 `echo -e` replaced by `printf '%b\n'`; re-run prints clean colour lines and
      `grep -c "echo -e"` returns 0 (Evidence 7).

## Evidence

Ran 2026-10-08 on `fix/dev-container-management-start-all`, Docker Compose v5.5.1. Probe runs used
copies of the script under `/tmp/opencode` with `COMPOSE_PROJECT_NAME` set, so they could not touch
the real stack; everything was removed afterwards (`docker ps -a` showed no probe containers).

**1. `sh -n`** — `exit=0`.

**2/3. Static checks**
```
grep -n "rsc-shared" project-tools/container-management.sh   -> line 15 only (comment)
grep -nE "(docker compose|docker run).*\| *(tail|head)"      -> line 54 only (comment)
grep -n -- "no-cache|force-recreate"                         -> 197, 200, 205, 208 (+start-all 129)
```

**4. Forced compose failure** (probe: no compose file in the repo root) — the old code printed the
error through `tail` and continued with status 0:
```
compose file ".../docker-compose.yml" is invalid: ... no such file or directory
Error: command exited with status 1
Error: Backend image build failed.
PROBE_A_exit=1
```

**5. Verify negative paths**
```
# probe B: backend alive, frontend `exit 3`
backend: running
Error: Frontend container exited with status 3.
PROBE_B_exit=1

# probe C: backend container exits immediately
=== Verifying ===
Error: Backend is not running.
PROBE_C_exit=1
```

**6. Real `start-all`, first run** (exit 0, backend untouched — still `Up 12 hours`, frontend
recreated). Note the stray `-e`: that is the pre-existing `echo -e` defect under dash, visible in
every line the script prints:
```
-e [0;32m=== Starting backend ===[0m
 Image 01_rsc_wpm_backend-backend Built
 Container 01_rsc_wpm_backend-postgres Healthy
-e [0;32m=== Starting frontend ===[0m
 Container 02_rsc_wp_bun_vue_frontend Starting
 Container 02_rsc_wp_bun_vue_frontend Started
-e [0;32m=== Verifying ===[0m
backend: running
frontend: exited 0 (its CMD is the frontend test suite)
START_ALL_exit=0
```

**7. After replacing `echo -e` with `printf '%b\n'`** — same run, no stray `-e`, colours intact:
```
[0;32m=== Starting backend ===[0m
 Image 01_rsc_wpm_backend-backend Built
 Container 01_rsc_wpm_backend-postgres Healthy
[0;32m=== Starting frontend ===[0m
 Container 02_rsc_wp_bun_vue_frontend Starting
 Container 02_rsc_wp_bun_vue_frontend Started
[0;32m=== Verifying ===[0m
backend: running
frontend: exited 0 (its CMD is the frontend test suite)
START_ALL_exit=0
```
`sh -n` re-run after the change: `exit=0`; `grep -c "echo -e"`: `0`.

Not run: the full backend/frontend test suites — this change touches no application code, only the
script. The suites stay as the gate for the separate 8-defect item in `TODO.md`.

## Next

Open the PR against `dev` and hand it over for the manual merge.

