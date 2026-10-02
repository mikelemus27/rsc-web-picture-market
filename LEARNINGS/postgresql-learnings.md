# PostgreSQL learnings

Project: `rsc-web-picture-market` — Bun backend and PostgreSQL in Docker Compose.

Use this as an operational reference for database readiness, schema initialization, persistent volumes, and API test failures. Verify current Compose settings before copying commands or assuming the database is configured as described.

## 1. Diagnose API failures from the database outward

During the backend and frontend API test runs, both suites failed on user operations:

- `GET /usuarios` returned HTTP 500.
- `POST /usuarios` returned HTTP 400.
- The backend logs showed PostgreSQL error `42P01`: `relation "usuario" does not exist`.
- `psql -U admin -d wpm_db -c '\dt'` showed no relations.

The API was reachable; this was not a network failure. The missing table was the confirmed cause. Inspect backend logs and the target database before changing API URLs or increasing timeouts.

Useful checks, run from the repository root:

```bash
docker compose -f _01_rsc_wpm_backend/docker-compose.yml logs --tail=100 backend
docker compose -f _01_rsc_wpm_backend/docker-compose.yml exec -T postgres \
  psql -U admin -d wpm_db -c '\dt'
```

`psql \dt` lists relations in the selected database. An empty result means the application schema is absent there; it does not prove the database server is unreachable.

## 2. Database readiness is not schema readiness

The Compose Postgres health check uses `pg_isready`, and the backend depends on Postgres being healthy. These checks ensure the server accepts connections before the backend starts. They do not create application tables.

Keep these responsibilities separate:

- A database health check verifies server availability.
- A schema initialization script or migration creates and evolves application tables.
- API integration tests verify that the service can use the expected schema.

The project schema currently defines the singular table `usuario` with an integer serial primary key, required `nombre`, and unique required `email`. The checked-in SQL source is [`_01_rsc_wpm_backend/db/init/01-schema.sql`](../_01_rsc_wpm_backend/db/init/01-schema.sql).

## 3. PostgreSQL image initialization scripts and existing volumes

The Compose database service mounts the schema file under `/docker-entrypoint-initdb.d/`. The official PostgreSQL image processes these initialization scripts when it initializes an empty data directory. A named volume that already contains a database is not initialized again when the container restarts.

Consequences:

- For a new database volume, the schema file is configured to create `usuario` automatically.
- For an existing database volume, adding or changing an init script does not apply the change. Use a migration or an explicit SQL operation against that database.
- The current missing-table issue was resolved without deleting the database volume by applying the idempotent `CREATE TABLE IF NOT EXISTS` statement, then verifying the table with `\dt`.
- `CREATE TABLE IF NOT EXISTS` creates a missing table; it does not modify an existing table to match a changed schema. Use versioned migrations for schema evolution.

Do not use `docker compose down -v` as a schema repair step. The `-v` option deletes Compose-managed named volumes and their database data. A normal `docker compose down` preserves named volumes.

## 4. Distinguish host and container connection settings

The backend connects to PostgreSQL over the Compose network using the service hostname `postgres` and PostgreSQL's container port `5432`. A host port mapping only controls connections from outside the Compose network; it does not change the port that the backend should use when connecting to `postgres`.

When inspecting a project, read the actual `ports:` mapping rather than assuming a host port. If another local database already uses the desired host port, choose a free host-side port while keeping the backend's in-network connection at `postgres:5432`.

## 5. Make API test assertions prove the contract

The backend and frontend user-creation tests currently allow statuses `[201, 409, 500]`. Such an assertion can accept an unexpected server error as a passing test. A test that verifies successful creation should require `201` and inspect the response body; duplicate-email behavior should be tested separately with the documented conflict status.

The regression run after creating `usuario` reported `4 pass, 0 fail` in each suite. Treat that as evidence for those specific cases and environment, not as proof that every database error path is covered.

## 6. Keep credentials and status claims safe

Do not put database passwords or other credentials in learning documents. Use placeholders in examples. A Git history rewrite does not rotate an exposed credential; rotate it separately and verify the active configuration before describing it as safe.

Mark environment-specific outcomes as historical snapshots. Check the current Compose files, database state, and test output before reusing old commands or claiming a service is healthy.

## 7. Verified incident record

For this incident:

1. Reproduced the backend and frontend suite failures against the running API.
2. Confirmed the backend error was missing relation `usuario`, not a failed database connection.
3. Confirmed the database contained no tables.
4. Created the table in the current volume without deleting it.
5. Re-ran both suites: backend `4 pass, 0 fail`; frontend `4 pass, 0 fail`.

The Compose init mount was validated as configuration, but the automatic initialization path was not tested by deleting and recreating a volume. Keep this distinction when reporting the level of verification.

## Related learning

- [Docker microservices and container learnings](./docker-microservices-containers-learnings.md) — networking, Compose test invocation, and the recorded missing-schema incident.
