# RSC Web Picture Market

A Bun and PostgreSQL project for an AI-generated media marketplace. The backend exposes a user API, and the repository includes frontend API contract tests, a database health-check CLI, and Docker Compose tooling.

## Current stack

| Component | Technology | Local endpoint or configuration |
|---|---|---|
| Backend | Bun, TypeScript, PostgreSQL client (`pg`) | `http://localhost:4001` |
| Database | PostgreSQL 16 | Compose service `postgres`, container port `5432`, database `wpm_db` |
| Frontend test client | Bun, TypeScript | API contract suite (`tests/`) and CLI workflow suite (`src/index.ts`), both calling the backend API |

The backend uses a controller/service/repository structure with PostgreSQL persistence.

## Start the project

From the repository root, run:

```bash
./project-tools/container-management.sh start-all
```

This builds and starts the backend and its PostgreSQL dependency, then starts the frontend Compose service. The frontend service runs the API test command and can exit after the tests finish; it is not a persistent web server.

Use Docker Compose directly to start only the backend and database:

```bash
docker compose -f _01_rsc_wpm_backend/docker-compose.yml up -d --build backend
```

The backend connects to PostgreSQL at `postgres:5432` inside the Compose network. Host port mappings are for connections from the host and do not change the backend's internal database port.

## Database schema

The PostgreSQL service mounts [`01-schema.sql`](_01_rsc_wpm_backend/db/init/01-schema.sql) into the image's initialization directory. On first initialization of an empty data volume, PostgreSQL creates the `usuario` table with a serial primary key, required `nombre`, and unique required `email`.

PostgreSQL processes initialization scripts only when it initializes an empty data directory. Restarting a database with an existing volume does not reapply these scripts. Apply schema changes to existing databases with a migration or an explicit SQL operation. Do not remove a data volume solely to re-trigger schema initialization.

## Run API tests

Start the backend and database first. These suites independently exercise the API from different network locations:

```bash
# Backend API suite inside the backend container.
./project-tools/container-management.sh test-backend --container

# Frontend API suite inside a temporary frontend container.
./project-tools/container-management.sh test-frontend
```

The backend suite targets `http://localhost:4001` from inside the backend container. The frontend suite uses `API_URL` from `_02_rsc_wp_frontend/.env` to reach the backend over the Compose network. A configured URL is not replaced with localhost if unreachable, so the frontend run will fail when its network route is broken.

To run backend unit and API tests locally instead, from the backend directory run:

```bash
cd _01_rsc_wpm_backend && bun run test:all
```

The API integration suites cover `GET /health` (including PostgreSQL readiness), list/create and error contracts, valid GET-by-ID, PUT (validation errors return 400, unknown ids 404) with a follow-up read to confirm persistence, and DELETE with a follow-up 404. Each CRUD scenario creates unique user data and removes it afterward.

The frontend also has a CLI workflow suite that exercises the API through the frontend's own service layer (list, create, invalid route, update, delete):

```bash
cd _02_rsc_wp_frontend && API_URL=http://localhost:4001 bun run test:suite
```

It provisions its own user and uses the returned id, so it does not depend on pre-existing rows. Override `API_URL` because `_02_rsc_wp_frontend/.env` points at the compose-internal hostname, which only resolves inside the Docker network.

The frontend test container needs network access to the running backend. These commands test API contracts; they do not render or launch a browser-based storefront.

## Container management

Run commands from the repository root:

| Command | Effect |
|---|---|
| `./project-tools/container-management.sh start-all` | Build and start backend, database, and frontend test service. |
| `./project-tools/container-management.sh stop-all` | Stop this project's backend and frontend containers; does not remove them or their data volumes. |
| `./project-tools/container-management.sh stop-running-containers` | Display and stop every running container in the active Docker context after an interactive confirmation. This includes containers unrelated to this project. Type `stop` when prompted to continue. |
| `./project-tools/container-management.sh rebuild-all` | Rebuild the project images and restart its services. |
| `./project-tools/container-management.sh test-backend` | Run backend unit and API tests on the host. |
| `./project-tools/container-management.sh test-backend --container` | Run backend handler unit tests on the host, then run backend API tests inside the running backend container. |
| `./project-tools/container-management.sh test-frontend` | Run frontend-origin API integration tests inside a temporary container. |
| `./project-tools/container-management.sh remove-all` | Remove stopped Compose containers and force-remove the named frontend container. It does not request removal of the PostgreSQL named volume. |
| `./project-tools/container-management.sh help` | Show available actions. |
| `./project-tools/db-healthcheck.sh` | Check database connectivity and schema: `--db-name`, `--tables`, `--columns <table>`, `--check <list>`, `-q <sql>`, `--file <path>`. See `db-healthcheck.sh --help`. |
| `./project-tools/rotate-db-secrets.sh` | Create or rotate the database credentials in `_01_rsc_wpm_backend/secrets/`: `init`, `rotate [--check]`, `status`. |

The global `stop-running-containers` action interrupts processes in all running containers and may discard unsaved in-memory state. It refuses to proceed without an interactive terminal and the exact confirmation.

## Configuration and security

Database credentials are not stored inline in the Compose files. The backend Compose stack loads
them from Docker Compose **secrets** — read-only files mounted at `/run/secrets/` inside each
container from `_01_rsc_wpm_backend/secrets/` (gitignored). Only the file paths, never the values,
appear in `docker inspect`, `docker compose config`, or `ps e`.

To populate the secrets for a fresh checkout:

```bash
./project-tools/rotate-db-secrets.sh init
./project-tools/rotate-db-secrets.sh status
```

(`rotate` applies a new password live with `ALTER USER`; rotation is fail-closed by design, and
recreating the postgres container does not change the password on an existing volume.)

The backend reads them through the `DB_USER_FILE` / `DB_PASSWORD_FILE` variables in
`src/infraestructura/database/postgres.ts`, falling back to plain env vars when the files are absent
(local non-Docker development). PostgreSQL uses its native `POSTGRES_USER_FILE` /
`POSTGRES_PASSWORD_FILE` variables.

The credential previously committed inline and present in Git history must be considered
compromised; a Git history rewrite does not rotate it. If the versioned volume predates the secrets
switch, it keeps the old password and must be recreated or its user altered for rotation to take effect.

Do not publish local `.env` files, the `secrets/` directory, database credentials, or generated
agent configuration. The root `.env` is not tracked; it only holds local non-Docker defaults, and
the Compose stack reads credentials exclusively from the `secrets/` files.

## Repository layout

```text
_01_rsc_wpm_backend/
├── db/init/                 # PostgreSQL initialization SQL for new data volumes
├── secrets/                 # Gitignored secret files loaded by Compose (see .gitkeep)
├── src/                     # Backend API and application layers
├── test/                    # Backend API contract tests
├── docker-compose.yml       # Backend and PostgreSQL services
└── run-backend-tests.ts     # Unified local/container test runner
_02_rsc_wp_frontend/
├── src/                     # Frontend CLI, workflow tests (src/users/tests/), and runner
├── tests/                   # Frontend API contract tests (usuarios.frontend.api.test.ts)
└── docker-compose.yml       # Frontend test service
LEARNINGS/                   # Reusable project and operations notes
project-tools/               # Container lifecycle, database health checks, and test commands
├── container-management.sh  # Start/stop/rebuild/test orchestration
├── db-healthcheck.sh        # DB connectivity, schema overview, and SQL checks
└── rotate-db-secrets.sh     # Create/rotate the DB credentials in secrets/
```

## Further documentation

| Document | Description |
|---|---|
| [`BackEnd_README.md`](_01_rsc_wpm_backend/BackEnd_README.md) | Backend architecture and API details. |
| [`FrontEnd_README.md`](_02_rsc_wp_frontend/FrontEnd_README.md) | Frontend CLI details. |
| [`PostgreSQL learnings`](LEARNINGS/postgresql-learnings.md) | Schema setup, readiness, volumes, and database troubleshooting. |
| [`Docker/container learnings`](LEARNINGS/docker-microservices-containers-learnings.md) | Compose networking, test execution, and container troubleshooting. |
| [`Git/GitHub learnings`](LEARNINGS/git-github-gh-commands-best-practices.md) | Branch, issue, and pull request practices. |
| [`New project structure and security practices`](LEARNINGS/new-projects-structure-n-secure-bests-practices.md) | Project layout conventions and security practices. |
| [`TODO.md`](TODO.md) | Persistent repository backlog shared across contributors, agents, and sessions. |