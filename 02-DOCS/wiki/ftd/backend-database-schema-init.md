# Backend database schema initialization

## Intent
Initialize the backend's required `usuario` table automatically so a fresh Compose database can serve requests and pass API tests.

## Scope
Add idempotent PostgreSQL initialization for new database volumes and document the setup. Preserve existing database volumes; this does not seed user data or drop/replace tables.

## Checklist
- [x] Add the `usuario` table schema as a PostgreSQL init script and mount it into the Compose database service; `docker compose config --quiet` passed.
- [x] Apply the same schema to the current empty database without removing its volume; `psql \dt` showed `public.usuario`.
- [x] Re-run backend and frontend API suites against the initialized database; each reported 4 pass and 0 fail.

## Evidence
Before the fix, both API suites failed reproducibly: `GET /usuarios` returned HTTP 500, backend logs reported `relation "usuario" does not exist`, and `psql \dt` showed no relations. After applying the schema, the backend container test suite and frontend API suite each reported 4 pass and 0 fail.

## Next
No further action for this fix. The new-volume Compose initialization hook is configured and validated, but was not tested by deleting/recreating the persistent volume; that destructive reset was intentionally avoided.
