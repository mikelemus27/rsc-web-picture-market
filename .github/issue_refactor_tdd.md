# Refactor TDD Test Suite for Backend

Scope: `_01_rsc_wpm_backend/test_debug.ts` and any future backend test artifacts.

Requirements:
- Convert `test_debug.ts` from manual `fetch` logging to structured `expect()` assertions (red-green-refactor cycle).
- Ensure every endpoint (`GET /usuarios`, `POST`, `PUT`, `DELETE`, `GET /:id`) has deterministic assertions (status + body structure).
- Add `test_debug` runner that fails CI (`exit 1`) when any assertion fails (`bun test`).
- Preserve `BASE_URL` env (`TEST_URL` or default `4001`) so tests stay environment-independent.
- Add DB seed reset (`wpm_db`) before each test run to avoid `DELETE` 404 failures after prior runs.
