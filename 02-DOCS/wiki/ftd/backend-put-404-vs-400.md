# Backend PUT: 400 for validation, 404 for missing user

## Intent

The `PUT /usuarios/:id` handler in `_01_rsc_wpm_backend/src/index.ts` returned **404 for every
error** in its catch block, including `UsuarioValidationError` (invalid email). HTTP status codes
must match semantics: **400 Bad Request** for an invalid payload/validation error, **404 Not
Found** only when the target user does not exist. Tracks GitHub issue #35.

## Scope

- `_01_rsc_wpm_backend/src/index.ts` — PUT catch block and its imports.
- `_01_rsc_wpm_backend/src/aplicacion/caso_uso/usuario/actualizar_usuarios/ActualizarUsuarioUseCase.ts` —
  throw a typed error instead of a bare `Error` for the missing-user case.
- `_01_rsc_wpm_backend/src/dominio/errors/UsuarioNotFoundError.ts` — new typed error, same pattern
  as `UsuarioValidationError`.
- `_01_rsc_wpm_backend/test/usuarios.backend.api.test.ts` — two new API tests.
- Not in scope: DELETE/GET handlers (already distinguish 404 correctly), the redundant
  `UsuarioService` pass-through layer (own TODO item).

## Checklist

- [x] Issue #35 created; branch `fix/dev-backend-put-404-vs-400` cut from `origin/dev`.
- [x] Root cause confirmed: `ActualizarUsuarioUseCase.execute` throws a bare
      `new Error("Usuario no encontrado")`; `Usuario.actualizar` throws
      `UsuarioValidationError("Email inválido para actualización")`; the PUT catch
      collapsed both (and anything else) into 404.
- [x] Typed `UsuarioNotFoundError` created in `dominio/errors`; the use case throws it.
- [x] PUT catch maps `UsuarioValidationError` → 400 and `UsuarioNotFoundError` → 404;
      anything else → 500 with a logged error (mirrors `CreateUsuarioHandler`).
- [x] API tests added: PUT invalid email → 400; PUT to a deleted id → 404.
- [x] Acceptance runs observed (see Evidence): 400, 404, happy path 200 unchanged,
      full backend suite green.

## Evidence

- `PUT /usuarios/<existing> {"nombre": ..., "email": "not-an-email"}` → **400**
  `{"error": "Email inválido para actualización"}`, no 404.
- `PUT /usuarios/<deleted-id> {"nombre": ..., "email": <valid>}` → **404**
  `{"error": "Usuario no encontrado"}`.
- Happy path unchanged: `PUT /usuarios/<existing>` with valid data → **200** + updated user,
  verified by re-reading the user (both API tests already covered).
- `bun run test:all` → N pass, 0 fail (previous 21 + 2 new API tests).
- `bunx tsc --noEmit` → zero errors.

## Next step

- TODO.md item "Fix PUT error handling in `index.ts`" moves to **Completed**.
- Future (optional): extract the PUT body handling into a `UpdateUsuarioHandler` (like
  `CreateUsuarioHandler`) so it is unit-testable without a live server — not accepted now,
  keeps this fix small.