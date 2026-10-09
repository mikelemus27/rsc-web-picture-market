# Frontend tests/ duplicates cleanup

## Intent

`_02_rsc_wp_frontend/tests/` holds six stale duplicate test files (`CreateUsuarioTest`,
`DeleteUsuarioTest`, `GetUserByIDTest`, `GetUsuariosTest`, `InvalidRouteTest`,
`UpdateUsuarioTest`) whose relative imports point at a pre-`src/` layout
(`../interfaces/ITest`, `../../core/...`, `../services/UsuarioApiService` from the repo
root), causing **20 `tsc --noEmit` errors (TS2307)**. The live copies live in
`src/users/tests/` and are the ones every entrypoint imports. Tracks GitHub issue #37.

## Scope

- Delete the six duplicate files under `_02_rsc_wp_frontend/tests/`.
- **Keep** `_02_rsc_wp_frontend/tests/usuarios.frontend.api.test.ts`: it is the real API
  suite run by `npm test`, `docker:frontend-test` and
  `project-tools/container-management.sh test-frontend` (11 tests), and the frontend
  container's `CMD bun test ./tests/usuarios.frontend.api.test.ts`.
- No source logic changes: the live tests in `src/users/tests/` are untouched.
- Not in scope: the hardcoded user IDs inside those live tests (own TODO item).

## Checklist

- [x] Issue #37 created; branch `chore/dev-frontend-tests-cleanup` cut from `origin/dev`.
- [x] Root cause confirmed: tsconfig has no `include`, so bare `tsc --noEmit` scans every
      file, including the stale copies; all 20 errors are TS2307 on
      `tests/<name>.ts` only. No `src/**` reference imports `./tests/` — every entrypoint
      imports `./users/tests/`.
- [x] Six stale duplicates removed with `git rm`; `tests/usuarios.frontend.api.test.ts` kept.
- [x] `grep` over the frontend confirms no remaining reference to the removed files.
- [x] Acceptance runs observed (see Evidence).

## Evidence

- Before: `bunx tsc --noEmit` → 20 errors (all `tests/*.ts` TS2307 module-not-found).
- After removal: `bunx tsc --noEmit` → **exit 0, zero errors**.
- `./project-tools/container-management.sh test-frontend` → **11 pass, 0 fail**
  (runs `tests/usuarios.frontend.api.test.ts` inside the frontend container).
- `grep -rn "tests/CreateUsuarioTest\|tests/DeleteUsuarioTest\|tests/GetUserByIDTest\|tests/GetUsuariosTest\|tests/InvalidRouteTest\|tests/UpdateUsuarioTest" _02_rsc_wp_frontend` →
  no matches (the `package.json`/Dockerfile/`container-management.sh` references are only
  to `tests/usuarios.frontend.api.test.ts`, which is kept).
- Frontend container one-shot job still exits 0 (CMD `bun test ./tests/usuarios.frontend.api.test.ts`).

## Next step

- TODO.md item "Delete or fix frontend `tests/` directory" moves to **Completed**.
- Future (optional): the live tests' hardcoded user IDs (item: "Fix hardcoded user IDs in
  frontend tests") remains open on the backlog — not part of this cleanup.