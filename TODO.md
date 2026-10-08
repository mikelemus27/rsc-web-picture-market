# TODO

This file is the persistent backlog for follow-up work in this repository. Use it across contributors, agents, and sessions; session-local task lists are not a substitute for this tracked file.

## Completed

- [x] **Harden `project-tools/db-healthcheck.sh` credentials.** Removed hardcoded defaults; resolves from env (`DB_PASS`/`PGPASSWORD`) or the backend secrets files (`secrets/db_user.txt`/`db_password.txt`), fails fast with an actionable message when no password exists. Done: no plaintext creds, 8/8 checks pass with the current stack. (2026-10-07 via `feat/rotate-db-secrets`)
- [x] **Implement `project-tools/db-healthcheck.sh`.** Created with 7-check health suite, query modes (`-q`, `--file`), color-coded output, proper exit codes. Verified: `./project-tools/db-healthcheck.sh` passes all checks; query mode works; exits 0/1 correctly. (2026-10-05)

## In Progress

## Open

- [ ] **Test the health-check failure response.** Extract `/health` response logic behind an injectable database probe if needed. Add a focused unit test that makes the probe reject and asserts HTTP 503, `{ "status": "unavailable" }`, and error logging. Keep the healthy 200 test passing. Do not stop/modify live PostgreSQL. Done when test fails if unavailable response/logging removed and passes otherwise.
- [ ] **Externalize and rotate database credentials.** Remove inline development credential values from backend Compose and load from ignored local env/secrets. Rotate any credential previously exposed (rewriting Git history does not invalidate). Verify Compose starts with documented setup, secret source excluded from Git, scan tracked files for credential literals without reproducing secrets in docs/logs.
- [ ] **Delete dead backend file `src/main.ts`.** Outdated duplicate of `index.ts` with wrong UsuarioService ctor (causes 2 tsc errors). Not the entry point. Done when `tsc --noEmit` in backend reports zero errors and file removed.
- [ ] **Delete or fix frontend `tests/` directory.** Duplicate copies with broken import paths cause ~20 tsc errors; real tests in `src/users/tests/`. Done when `tsc --noEmit` in frontend reports zero errors.
- [ ] **Fix hardcoded user IDs in frontend tests.** `src/index.ts` passes `1` (UpdateUsuarioTest) and `20` (DeleteUsuarioTest) — will 404 if those users don't exist. Provision dynamically and use returned ID (match backend API test pattern). Done when frontend test suite passes without pre-existing users 1/20.
- [ ] **Fix PUT error handling in `index.ts`.** PUT catch block returns 404 for all errors, including `UsuarioValidationError` (invalid email). Return 400 for validation errors; reserve 404 for "not found". Done when PUT with invalid email returns 400 and PUT to non-existent user returns 404.
- [ ] **Remove redundant `UsuarioService` pass-through layer.** Methods re-wrap DTOs even though use cases already return DTOs. Either call use cases directly from controller, or give service real responsibility (transactions/domain events). Done when pass-through mapping eliminated or service has clear business logic.
- [ ] **Clean up dead backend files.** Remove `src/indexOld.ts` (legacy), `test_debug.ts` (debug), and evaluate `commands.md` (purpose unclear). Done when removed and nothing references them.
- [ ] **Fix `InvalidRouteTest` hardcoded URL.** `/tests/InvalidRouteTest.ts` uses `http://localhost:4001/ruta-inexistente` directly (breaks in containerized runs). Also note `src/users/tests/InvalidRouteTest.ts` same issue; both should use injected base URL/service. Done when tests use injected base URL.
- [ ] **Use `process.env.PORT` for backend server port.** `src/index.ts` hardcodes `port: 4001` (also `src/main.ts` until removed). Read from env with fallback. Done when server starts on `process.env.PORT` when set.
- [ ] **Add pagination to `GET /usuarios`.** Returns all users with no limit. Add `limit`/`offset` query params with sensible defaults and pagination metadata. Done when response includes pagination metadata and respects query params.
- [ ] **Add authentication and authorization to the API.** All endpoints open. Implement at minimum API key/JWT middleware for protected routes. Done when unauthenticated requests to `/usuarios` return 401.
- [ ] **Add CORS configuration.** No CORS headers; blocks browser requests. Add configurable CORS middleware. Done when cross-origin requests from allowed origins succeed.
- [ ] **Add rate limiting.** No rate limiting. Add in-memory limiter (e.g., 100 req/min/IP). Done when excessive requests return 429.
- [ ] **Fix defects in `project-tools/container-management.sh` per `FIX_TODO_ContainerManagement_05102026_1.md`.** Priority: (1) replace invalid `--filter name=` with positional service form; (2) distinguish compose errors from stopped containers (don't swallow stderr); (3) `help` must exit 0; (4) unknown action must print "Unknown action" and exit 1; (5) fix `check_backend_running`/`check_frontend_network` (dead/misnamed); (6) remove hardcoded container name; (7) don't hide failures in stop-all/remove-all with `|| true`; (8) add `project-tools/tests/container-management.test.sh` and prove it fails on reintroduced defects. Do NOT change non-TTY refusal in stop-running-containers. Done when all 8 tasks complete, `sh -n` passes, harness passes, existing suites (16/16 backend, 11/11 frontend) still pass.
- [x] **Implement Docker Compose secrets per `SECURE_SECRETS_PLAN.md`.** Use `secrets:` with file mounts; create ignored secret files; update compose to use `*_FILE` vars; update `postgres.ts` to read secret files with fallback; document in README. Done when `docker inspect` shows only file paths (no passwords), stack starts cleanly, `/health` returns 200, all tests pass. Verified: compose config + inspect show only `/run/secrets/` paths; rotated password (volume recreated); `/health` 200; backend 16/16 (5 unit + 11 API) and frontend 11/11 pass. (2026-10-07)

## Backlog maintenance

- Add a checkbox item when follow-up work is identified but is not being implemented in the current change.
- Write each item so a future contributor can understand the goal and how to verify completion without relying on chat history.
- Remove or mark an item complete only after its acceptance criteria have been implemented and verified. Record relevant test evidence in the corresponding change or feature documentation.
- Review this file at the start of repository work and update it when completing or discovering follow-up work.
