# Refactor TDD Test Suite for Frontend

Scope: `_02_rsc_wp_frontend/src/users/tests/*.ts` and `src/index.ts` (`test:suite`).

Requirements:
- Convert existing scripts (`CreateUsuarioTest`, `GetUsuariosTest`, etc.) into `describe/test/expect()` assertions (red-green-refactor).
- Use `TEST_URL` / `API_URL` env to avoid hardcoding `localhost:3000`.
- Add `expect()` assertions (status + body shape) instead of only `console.dir`.
- Preserve `test:suite` (`bun run src/index.ts`) for execution but add `bun test` support via `.test.` naming.
- Ensure `.env` (port `4001`) is used; `.env` excluded from repo (`.gitignore`).
