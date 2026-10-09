# Frontend tests hardcoded ids

## Intent

`_02_rsc_wp_frontend/src/index.ts` wires `UpdateUsuarioTest` with the hardcoded id `1`
and `DeleteUsuarioTest` with id `20`. Those workflow tests 404 unless users 1/20 already
exist in the database, so the suite is not deterministic on a database without them.
Provision a helper user dynamically (POST /usuarios -> 201 -> returned id) and use that
id for Update/Delete; the Delete step removes the helper, leaving no residue. Matches
the dynamic-provisioning pattern already used by the backend API suite. Tracks GitHub
issue #39.

## Scope

- `_02_rsc_wp_frontend/src/index.ts` only: replace the module-scope `tests` wiring, add
  `provisionTestUser()`, build the tests array inside `main()` with the provisioned id.
- No changes to the test classes (`UpdateUsuarioTest`, `DeleteUsuarioTest`), the service,
  or the workflow entrypoints.
- Not in scope: `tests/usuarios.frontend.api.test.ts` is already dynamic
  (`crypto.randomUUID()` per email) and stays untouched.

## Checklist

- [x] Issue #39 created; branch `fix/dev-frontend-tests-hardcoded-ids` cut from
      `origin/dev`.
- [x] Root cause confirmed: literal ids 1/20 in `src/index.ts`; those rows do not exist
      in the current database (ids are 214/215+ in this environment), so Update/Delete
      would 404.
- [x] `provisionTestUser()` added; tests array built inside `main()` with the
      provisioned id; Delete removes the helper user.
- [x] Acceptance runs observed (see Evidence).

## Evidence

- `bunx tsc --noEmit` -> **exit 0, zero errors**.
- `bun run src/index.ts` (frontend workflow suite) -> **5 pass, exit 0** without
  pre-existing users 1/20: Update and Delete report the provisioned id only
  (observed: "Usuario 257 Actualizado correctamente" / "Usuario 257 eliminado
  correctamente"). Run from the host with `API_URL=http://localhost:4001` — the
  frontend `.env` points at `http://01_rsc_wpm_bun_psgres-backend:4001`, which only
  resolves inside the compose network.
- `./project-tools/container-management.sh test-frontend` -> **11 pass / 0 fail** baseline
  unchanged.

## Next step

- TODO.md item "Fix hardcoded user IDs in frontend tests" moves to **Completed**.
- PR against `dev` with `Closes #39`; user merges; `dev` fast-forwarded and re-verified.