# Create-user status contract (#14)

## Intent
Make create-user tests distinguish successful creation, duplicate users, invalid input, and unexpected server failures. Correct the active backend HTTP handler so each response reflects the failure type.

## Scope
In scope: backend and frontend API tests for HTTP 201 on unique creation and HTTP 409 on duplicate creation; backend create-handler validation and unexpected-error mapping; focused handler unit tests; relevant test command/documentation updates.

Out of scope: consolidating backend and frontend API test files into one shared suite, changing unrelated endpoints, or broad repository-wide error handling.

## Checklist
- [x] Add focused create-handler tests that fail before the fix for input validation, duplicate errors, and unexpected errors; verify expected 400, 409, and 500 responses.
- [x] Tighten backend and frontend API tests: assert 201 for unique creation, and assert 409 only after the same email was successfully created once.
- [x] Correct the backend POST handler to validate request shape, map known validation and duplicate failures to 400/409, and return a generic 500 for unexpected failures.
- [x] Ensure backend local test commands execute the focused handler tests, while the backend-container and frontend-container commands continue independently exercising the live API.
- [x] Run backend local tests and both container API test modes; record observed results.
- [x] Update directly relevant backend test documentation with the clarified status behavior and commands.

## Evidence
- Before the fix, `POST /usuarios` with `{"nombre":7,"email":"invalid-type@example.com"}` returned HTTP 500; the added backend API regression test failed with `Expected: 400, Received: 500`.
- New handler tests passed: 5 passed, 0 failed (8 assertions); they cover 201, malformed input 400, duplicate 409, domain validation 400, and unexpected error 500 with a generic response.
- Backend local test command: 12 passed, 0 failed (17 assertions; unit + API).
- Backend container mode: 5 handler unit tests passed locally (8 assertions), followed by 7 API tests passed inside the running backend container (9 assertions).
- Frontend container mode: 7 API tests passed against the backend by Compose service name.
- `docker compose ... up -d --build backend` built and started the new backend successfully; the existing PostgreSQL container and volume were preserved.
- `bash -n project-tools/container-management.sh`, `git diff --check`, and `docker compose -f _01_rsc_wpm_backend/docker-compose.yml config --quiet` passed.

## Next
Implementation and targeted verification are complete on `fix/create-user-test-status-codes-14`; ready for review.
