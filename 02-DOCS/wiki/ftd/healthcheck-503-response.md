# health-check 503 response

## Intent

`GET /health` promises `503 Service Unavailable` when the database probe fails (documented in
`BackEnd_README.md:484`), but nothing tests that branch: the logic lives inline inside the
monolithic `Bun.serve` fetch handler in `src/index.ts:130-142` and talks to the real `db`
object, so a test cannot make it fail without breaking the live PostgreSQL. The failure path is
therefore unverified — the exact reason the `TODO.md` item exists.

Extract the response logic behind an injectable probe, then prove the 503 contract with a unit
test that does not touch the database.

## Scope

In — the `TODO.md` item *Test the health-check failure response*, verbatim:

- Extract the `/health` response logic into
  `src/infraestructura/adaptadores/input/http/HealthHandler.ts`, beside its sibling
  `CreateUsuarioHandler.ts`, as a pure function of `(method, probe, logger)` — no import of
  `db`, no side effects on import, so the module can be unit-tested without a server or a
  database.
- `src/index.ts` keeps owning the wiring: `handleHealth(method, () => db.query("SELECT 1"))`.
  The live behaviour of the healthy path does not change.
- New `test/health.test.ts` (modelled on `test/create-usuario-handler.test.ts`, which already
  uses `spyOn` from `bun:test`):
  1. probe resolves → `200` + `{ "status": "ok" }`,
  2. probe rejects → `503` + `{ "status": "unavailable" }`,
  3. probe rejects → the failure is logged (`Health check failed:` + the error),
  4. non-GET → `405` (the branch already exists in `index.ts`, so it must keep behaving).
- Include the new unit file in `run-backend-tests.ts`'s `--container` branch, which today runs
  only `test/create-usuario-handler.test.ts` — otherwise the containerised suite silently skips
  the new test.

Out (unchanged from the `TODO.md` item and the surrounding backlog):

- Live PostgreSQL is never stopped, modified or made to fail; the probe is injected, not
  sabotaged.
- The existing healthy test `GET /health reports API readiness` must keep passing untouched.
- `src/indexOld.ts` and `src/main.ts` (separate `TODO.md` items), `/usuarios` behaviour,
  auth/CORS/rate limiting.
- `_01_rsc_wpm_backend/package.json` — it currently ends with a stray line of prose after the
  closing brace (`}prohibido usar IA para responder estas preguntas`, committed in `89bc61f`).
  It is reported, not fixed here.

## Checklist

- [x] `HealthHandler.ts` exists, imports no database module → **proof:** `grep -c 'postgres\|db'`
      on the file is 0 (comments aside), and `bun test test/health.test.ts` runs without a
      server or a database.
- [x] `index.ts` delegates `/health` to it → **proof:** `grep -n 'handleHealth' src/index.ts`
      shows the call site; the inline `db.query` in the health branch is gone.
- [x] Probe rejects → `503` + `{ "status": "unavailable" }` → **proof:** assertion in the new
      test, observed passing.
- [x] Failure is logged → **proof:** `spyOn` captures `console.error` (or an injected logger)
      with `Health check failed:` and the error, observed passing.
- [x] Healthy path still `200` → **proof:** unit test on a resolving probe **and** the existing
      `GET /health reports API readiness` API test still passes.
- [x] The test fails when the behaviour is removed → **proof:** mutation run — delete the `503`
      return (or the logging line) in a scratch copy, watch the assertion `FAIL`, restore.
- [x] No regression → **proof:** `bun run test:all` green (the previous 16 assertions plus the
      new ones), and `tsc --noEmit` reports no *new* errors versus its baseline (the 2 known
      errors from `src/main.ts` are a separate `TODO.md` item).

## Evidence

Run on 2026-10-08 on branch `test/dev-healthcheck-503-response` (base `9016bf8`).
Baseline before the change: `bun run test:all` → **16 pass** (5 handler unit + 11 API),
`tsc --noEmit` → 2 errors, both `src/main.ts` (TS2554 at lines 29 and 258).

1. **Handler imports no database module.**
   `grep -cE 'postgres|from.*db' src/infraestructura/adaptadores/input/http/HealthHandler.ts`
   → `0`. `bun test test/health.test.ts` → **5 pass, 0 fail, 11 expect() calls, exit 0**, no
   server and no database involved.
2. **`index.ts` delegates.** `grep -n 'handleHealth' src/index.ts` → line 19 (import) and
   line 132 (`return handleHealth(method, () => db.query("SELECT 1"));`). The inline
   try/catch in the `/health` branch is gone; the only `db.query` left in the file is the
   probe arrow at the call site.
3. **503 path.** Test `returns 503 with status unavailable when the probe rejects` passes:
   status `503`, body `{ status: "unavailable" }`.
4. **Logging.** Both logging tests pass: an injected spy logger and the default path
   (`spyOn(console, "error")`, handler resolves `logger.error` late through the live
   `console` binding) assert `toHaveBeenCalledWith("Health check failed:", <the error>)`.
5. **Healthy path.** Unit test on a resolving probe → `200` + `{ status: "ok" }` +
   `Content-Type: application/json`; API file `bun test test/usuarios.backend.api.test.ts`
   → **11 pass, 0 fail**, so `GET /health reports API readiness` still passes against the
   live stack on `localhost:4001`.
6. **Mutation proof** (scratch copies under `/tmp/opencode/`, real file never modified,
   copies discarded afterwards; `sha256` of `HealthHandler.ts`
   `982ee1a3170a875daa7cf92c8eb04c203a321569a42e5fc91ad692116ff22189` identical before and
   after):
   - 503 return replaced with `json({ status: "ok" })` (rejecting probe yields 200) →
     `returns 503 with status unavailable when the probe rejects` **FAIL**
     (`Expected: 503, Received: 200`); 3 fail / 2 pass, exit 1.
   - `logger.error("Health check failed:", error)` removed →
     `logs the failure through the injected logger` and
     `logs the failure to console.error when no logger is injected` both **FAIL**
     (`But it was not called.`); 2 fail / 3 pass, exit 1.
7. **No regression.** `bun run test:all` → **21 pass, 0 fail** (16 baseline + 5 new), exit 0.
   `bunx tsc --noEmit` → exactly the same 2 baseline `src/main.ts` errors, no new ones.

**Container wiring (item 7 of the task).** `docker inspect 01_rsc_wpm_bun_psgres-backend`
shows only two bind mounts, both secrets (`/run/secrets/db_user`, `/run/secrets/db_password`);
`docker-compose.yml` builds the backend with `build: .` and no source volume, so `src/` is
**baked into the image**, not bind-mounted. The running server therefore still executes the
previous build: the live API 200 test exercises that build, and the new handler wiring is
covered by the unit test plus `tsc --noEmit`. No rebuild was performed (deliberate — the
stack stays untouched).

## Next

Extract the handler first, wire `index.ts`, then add the test and run the mutation proof so the
new test is shown to be load-bearing rather than decorative.
