# RSC Web Picture Market

A Bun and PostgreSQL project for an AI-generated media marketplace. The backend exposes a user API, and the repository includes frontend API contract tests and Docker Compose tooling.

## Current stack

| Component | Technology | Local endpoint or configuration |
|---|---|---|
| Backend | Bun, TypeScript, PostgreSQL client (`pg`) | `http://localhost:4001` |
| Database | PostgreSQL 16 | Compose service `postgres`, container port `5432`, database `wpm_db` |
| Frontend test client | Bun, TypeScript | Calls the backend API |

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

Start the backend and database first. From the repository root, run the backend API tests inside the running Compose backend:

```bash
./project-tools/container-management.sh test-backend --container
```

The command copies the test file into the backend container, runs Bun's test runner against `http://localhost:4001` from inside that container, and removes the temporary test file afterward.

Run the backend tests on the host instead:

```bash
./project-tools/container-management.sh test-backend
```

Run the frontend API contract tests in a temporary Compose container:

```bash
./project-tools/container-management.sh test-frontend
```

The frontend test container needs network access to the running backend. These commands test API contracts; they do not render or launch a browser-based storefront.

## Container management

Run commands from the repository root:

| Command | Effect |
|---|---|
| `./project-tools/container-management.sh start-all` | Build and start backend, database, and frontend test service. |
| `./project-tools/container-management.sh stop-all` | Stop this project's backend and frontend containers; does not remove them or their data volumes. |
| `./project-tools/container-management.sh stop-running-containers` | Display and stop every running container in the active Docker context after an interactive confirmation. This includes containers unrelated to this project. Type `stop` when prompted to continue. |
| `./project-tools/container-management.sh rebuild-all` | Rebuild the project images and restart its services. |
| `./project-tools/container-management.sh test-backend [--container]` | Run backend API tests locally or inside the backend container. |
| `./project-tools/container-management.sh test-frontend` | Run frontend API tests in a temporary container. |
| `./project-tools/container-management.sh remove-all` | Remove stopped Compose containers and force-remove the named frontend container. It does not request removal of the PostgreSQL named volume. |
| `./project-tools/container-management.sh help` | Show available actions. |

The global `stop-running-containers` action interrupts processes in all running containers and may discard unsaved in-memory state. It refuses to proceed without an interactive terminal and the exact confirmation.

## Configuration and security

Review the backend and frontend Compose files before running this project in a shared or production environment. The backend Compose configuration currently contains database credentials directly in the file. Replace development credentials with local, ignored environment configuration or a secrets manager before exposing the services; rotate any credential that has been shared or committed.

Do not publish local `.env` files, database credentials, or generated agent configuration. A Git history rewrite does not rotate a credential.

## Repository layout

```text
_01_rsc_wpm_backend/
├── db/init/                 # PostgreSQL initialization SQL for new data volumes
├── src/                     # Backend API and application layers
├── test/                    # Backend API contract tests
├── docker-compose.yml       # Backend and PostgreSQL services
└── run-backend-tests.ts     # Unified local/container test runner
_02_rsc_wp_frontend/
├── src/                     # Frontend CLI and user API utilities
├── tests/                   # Frontend API contract tests
└── docker-compose.yml       # Frontend test service
LEARNINGS/                   # Reusable project and operations notes
project-tools/               # Container lifecycle and test commands
```

## Further documentation

| Document | Description |
|---|---|
| [`BackEnd_README.md`](_01_rsc_wpm_backend/BackEnd_README.md) | Backend architecture and API details. |
| [`FrontEnd_README.md`](_02_rsc_wp_frontend/FrontEnd_README.md) | Frontend CLI details. |
| [`PostgreSQL learnings`](LEARNINGS/postgresql-learnings.md) | Schema setup, readiness, volumes, and database troubleshooting. |
| [`Docker/container learnings`](LEARNINGS/docker-microservices-containers-learnings.md) | Compose networking, test execution, and container troubleshooting. |
| [`Git/GitHub learnings`](LEARNINGS/git-github-gh-commands-best-practices.md) | Branch, issue, and pull request practices. |
