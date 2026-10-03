# Container API integration coverage

## Intent
Run a comprehensive API integration suite independently from the backend and frontend containers so both network paths are verified, including health, valid GET-by-ID, PUT, and DELETE behavior.

## Scope
In scope: add an API readiness endpoint that checks PostgreSQL connectivity; expand both container-facing API suites with isolated CRUD scenarios; remove configured-host fallback that could mask a broken container network; document commands and expected coverage.

Out of scope: consolidating the duplicated backend and frontend test files, changing unrelated API behavior, or altering container/database lifecycle and persistent data.

## Checklist
- [x] Add `GET /health` readiness behavior and verify successful database connectivity returns 200.
- [x] Expand backend and frontend API suites with valid GET-by-ID, PUT with persisted-value verification, and DELETE with post-delete 404; ensure test-created users are cleaned up.
- [x] Ensure each suite uses its configured API host without silently switching to localhost; retain localhost only as the no-configuration local default.
- [x] Update test documentation and command descriptions to reflect comprehensive API integration coverage and prerequisites.
- [x] Run backend-local tests and the backend-container and frontend-container API suites independently; record observed results and confirm both container targets are actually used.

## Evidence
- Before implementation, the new backend health integration test failed with `Expected: 200, Received: 404`; the existing GET-by-ID, PUT, and DELETE scenarios passed against the running API.
- `curl http://localhost:4001/health` returned `{"status":"ok"}` after rebuilding only the backend service. PostgreSQL remained running and healthy; its named volume was not removed or recreated.
- Backend local: final `bun run test:all` passed 16 tests, 0 failed (36 assertions), including 5 handler unit tests and 11 API integration tests.
- Backend container: `./project-tools/container-management.sh test-backend --container` passed 5 handler unit tests locally and 11 API integration tests inside the backend container (28 API assertions), targeting `http://localhost:4001`.
- Frontend container: `./project-tools/container-management.sh test-frontend` passed 11 API integration tests (28 assertions), targeting `http://01_rsc_wpm_bun_psgres-backend:4001` over the Compose network.
- Both test files now use the configured `API_URL` directly; there is no network-failure fallback to localhost. The health endpoint returns 503 and logs an error if its PostgreSQL query rejects; that unavailable branch was not fault-injected because the running persistent database was left undisturbed.
- `bash -n project-tools/container-management.sh`, `git diff --check`, and both backend and frontend Compose `config --quiet` checks passed after the full change set.
- Updated the root, backend, and frontend READMEs with the current test commands, network locations, integration coverage, and data cleanup behavior. Updated Docker/PostgreSQL learning notes with current results and explicitly labeled the earlier 4-test counts as historical.

## Next
Implementation, verification, and documentation are complete; the work is ready for review.
