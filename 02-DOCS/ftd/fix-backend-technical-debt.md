# Fix Backend Technical Debt and Compilation Errors

## Intent
Resolve blocking TypeScript compilation errors, repair folder naming anomalies, clean dead/broken artifacts, fix HTTP status code contract mismatches in `UsuarioController` and `src/index.ts`, and wire `DB_PORT` in the PostgreSQL connection configuration. This establishes a clean, fully compilable baseline for future marketplace domain features.

## Scope
- In scope:
  - Remove dead file `_01_rsc_wpm_backend/src/dominio/eAUser.ts`.
  - Fix syntax error at end of `_01_rsc_wpm_backend/src/main.ts`.
  - Rename `src/aplicacion/caso_uso/usuario/crear _usuario/` to `crear_usuario/` and update references.
  - Fix type annotations in `ObtenerUsuarioUseCase.ts` and `EliminarUsuarioUseCase.ts` to `IUsuarioRepositoryPort`.
  - Remove unused `express` import in `UsuarioController.ts`.
  - Fix error handling in `UsuarioController.ts` and `src/index.ts` so domain/duplicate errors return appropriate 4xx codes rather than 201 or unhandled 500s.
  - Support `DB_PORT` in `_01_rsc_wpm_backend/src/infraestructura/database/postgres.ts`.
  - Ensure `bunx tsc --noEmit` passes cleanly with 0 errors.
- Out of scope:
  - Modifying CLI test client in `_02_rsc_wp_frontend` (addressed in subsequent work).
  - Implementing new marketplace entities (Picture, Video, Audio, Cart) - to be done in next FTD feature.

## Checklist
- [ ] 1. Remove `_01_rsc_wpm_backend/src/dominio/eAUser.ts` — verified by file deletion and git status.
- [ ] 2. Fix syntax in `_01_rsc_wpm_backend/src/main.ts` — verified by clean parse.
- [ ] 3. Rename `crear _usuario/` folder to `crear_usuario/` and update imports — verified by directory presence and import resolution.
- [ ] 4. Fix `IUsuarioRepositoryPort` types in `ObtenerUsuarioUseCase.ts` and `EliminarUsuarioUseCase.ts` — verified by type check.
- [ ] 5. Clean unused Express import and improve error handling in `UsuarioController.ts` and `src/index.ts` — verified by code review and status handling.
- [ ] 6. Add `DB_PORT` to `postgres.ts` — verified by file inspection.
- [ ] 7. Execute `bunx tsc --noEmit` in `_01_rsc_wpm_backend` — verified by exit code 0 and 0 errors found.

## Evidence
- (Pending execution)

## Next
- Execute task 1 & 2: remove `eAUser.ts` and fix syntax in `main.ts`.
