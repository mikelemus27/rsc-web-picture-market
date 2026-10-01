# Remote API URL Fallback

## Intent
When `API_URL` points to an unreachable remote API, use the local frontend API URL so the integration tests can still run locally.

## Scope
- In scope: resolve one base URL before the test cases run; use `API_URL` if its `/usuarios` endpoint responds, otherwise warn and fall back to `http://localhost:4001`.
- Out of scope: switching URLs after individual tests fail, treating remote HTTP error statuses as connection failures, or changing endpoint assertions.

## Checklist
- [x] Add a bounded remote availability check and local fallback — verified with the test suite when `API_URL` was unset and when it pointed to an unreachable address.
- [x] Preserve remote HTTP error responses as remote responses — verified by inspection: the availability check uses any resolved `fetch` response without branching on its HTTP status.
- [x] Run the frontend API test suite and targeted type-check for the modified test.

## Evidence
- `env -u API_URL bun test tests/usuarios.frontend.api.test.ts` — 4 tests passed; the suite selected `http://localhost:4001`.
- `API_URL=http://127.0.0.1:1 bun test tests/usuarios.frontend.api.test.ts` — 4 tests passed; the unavailable remote produced a connection error and the suite fell back to local.
- `API_URL=http://localhost:4001 bun test tests/usuarios.frontend.api.test.ts` — 4 tests passed; the configured responding API was selected.
- `bunx tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --types bun tests/usuarios.frontend.api.test.ts` — passed.
- The package-wide `bun run typecheck` was also attempted but reports pre-existing unresolved imports in other test files (for example `../interfaces/ITest` and `../../core/types/TTestResult`); it does not identify errors in the modified API contract test.

## Next
- Review the fallback behavior and decide whether to keep it.
