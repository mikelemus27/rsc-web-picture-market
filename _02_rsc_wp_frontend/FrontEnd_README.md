# CLI Front - Test Client for Users Docker Service

[![Runtime: Bun](https://img.shields.io/badge/Runtime-Bun%20v1.3+-black?logo=bun)](https://bun.com)
[![Language: TypeScript](https://img.shields.io/badge/Language-TypeScript%205.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Architecture: Clean%20OOP](https://img.shields.io/badge/Architecture-Clean%20OOP%20%2F%20Modular-brightgreen)](#architecture)
[![Status: Functional](https://img.shields.io/badge/Status-Tested%20%26%20Active-success)](#)

A modular, extensible Command-Line Interface (CLI) testing and inspection client written in **TypeScript** using **Bun**. Designed to interact with, monitor, and validate Dockerized backend microservices (specifically the Users / Usuarios REST API running at `http://localhost:3000`).

---

## 📋 Table of Contents

- [Objective](#-objective)
- [Key Features](#-key-features)
- [Tech Stack & Tools](#-tech-stack--tools)
- [Architecture & Design Patterns](#-architecture--design-patterns)
- [Directory Structure](#-directory-structure)
- [Prerequisites](#-prerequisites)
- [Available Commands](#-available-commands)
- [Usage Examples](#-usage-examples)
  - [1. Running the Full Test Suite](#1-running-the-full-test-suite)
  - [2. Running Individual Operations](#2-running-individual-operations)
  - [3. Sample Terminal Output](#3-sample-terminal-output)
- [Adding New Tests](#-adding-new-tests)
- [License](#-license)

---

## 🎯 Objective

This project serves as an automated test harness and terminal-based frontend client for validating microservices running in Docker or local environments:

1. **API Contract Verification**: Validates HTTP status codes, JSON response formats, and error handling for the `/usuarios` REST API endpoints.
2. **Decoupled Architecture**: Demonstrates clean Object-Oriented Programming (OOP) and SOLID principles in TypeScript (Dependency Injection, Interface Segregation, and the Command Pattern).
3. **Developer Ergonomics**: Offers both full test suite automation (with tabular reporting and pass/fail metrics) and dedicated one-off operational scripts (`list`, `create`, `get`, `update`, `delete`).

---

---
## 📝 Note on Container Lifecycle (Test vs Live App)

**Current state (CLI test client)**: The frontend container runs a dedicated Bun API integration suite against the backend hostname configured by `API_URL`. It does **not** stay running (`restart: "no"` in `docker-compose.yml`) because this frontend is only a test harness fetching the backend API (`http://01_rsc_wpm_bun_psgres-backend:4001`).

**When evolving to an actual Vue/React app**: The container must become a **live server** (e.g., `bun run src/index.ts`, `CMD ["bun", "serve", "src/index.html"]`, or `npm run dev` with a persistent web server). At that point:
- Change `Dockerfile` `CMD` to start the server (not `bun test`).
- Set `restart: unless-stopped` (or `always`) in `docker-compose.yml`.
- Expose the app port (e.g., `ports: - "3000:3000"`) so the host/browser can reach it.
- The `.env` (`API_URL`) is only for tests; a live Vue frontend would serve static assets or proxy to backend separately — this CLI is decoupled from that architecture.
---

- **Automated Test Orchestrator (`TestRunner`)**: Sequentially executes test instances, catches runtime exceptions, and collects standardized test metrics (`TTestResult`).
- **Tabular & Summary Visualizers**:
  - `TablePrinter`: Displays test results in a clear matrix using `console.table`.
  - `SummaryReporter`: Computes and prints pass/fail totals with visual alerts.
  - `ConsolePrinter`: Provides standardized UTF-8 emojis (`✅`, `❌`, `📌`, `📊`) and formatted console section headers.
- **API Integration Coverage**: The container runs its own end-to-end API checks over the Compose network: `GET /health` verifies API/database readiness; list and create endpoints check response contracts; GET-by-ID checks a created user; PUT checks both its response and persisted values; DELETE verifies a follow-up GET returns 404. Each CRUD test creates uniquely named data and removes it afterward.
- **Standalone Interactive Scripts**: Standalone CLI entrypoints for inspecting specific API operations without running the full test harness.
- **Zero Heavy Dependencies**: Runs directly on native Bun runtime without bulky third-party libraries (no axios, no jest, no express).

---

## 🛠 Tech Stack & Tools

| Component | Technology | Description |
|---|---|---|
| **Runtime** | [Bun](https://bun.com) (`>= 1.3.x`) | Fast, all-in-one JavaScript & TypeScript runtime, package manager, and bundler. |
| **Language** | [TypeScript](https://www.typescriptlang.org/) (`^5.x`) | Strongly typed JavaScript with strict type-checking enabled. |
| **HTTP Client** | Web Standard `fetch` | Native HTTP client wrapped in an injectable `HttpClient` service. |
| **Compiler Options** | ESNext / Bundler | `verbatimModuleSyntax`, `strict: true`, native ES Modules. |
| **Target Service** | REST Microservice | User service containerized via Docker (default port: `3000`). |

---

## 🏛 Architecture & Design Patterns

The project follows a layered, modular architecture with clear separation of responsibilities:

```
┌─────────────────────────────────────────────────────────────┐
│                 CLI Entrypoints & Runners                   │
│  src/index.ts (Full Suite) | src/listUsers.ts | createUser… │
└───────────────┬─────────────────────────────┬───────────────┘
                │                             │
                ▼                             ▼
┌──────────────────────────────┐ ┌───────────────────────────┐
│     Orchestration Layer      │ │     Presentation Layer    │
│  TestRunner                  │ │  ConsolePrinter           │
│  SummaryReporter             │ │  TablePrinter             │
└───────────────┬──────────────┘ └───────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│                      Test Cases Layer                       │
│  Implements ITest Interface (run(): Promise<TTestResult>)   │
│  CreateUsuarioTest | GetUsuariosTest | UpdateUsuarioTest... │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│                    Service & HTTP Layer                     │
│  UsuarioApiService (Domain REST Methods)                    │
│  HttpClient (Abstraction over fetch)                        │
└───────────────┬─────────────────────────────────────────────┘
                │ HTTP Requests
                ▼
┌─────────────────────────────────────────────────────────────┐
│            Backend Microservice (Docker / Local)            │
│            http://localhost:3000/usuarios                   │
└─────────────────────────────────────────────────────────────┘
```

### Applied Design Patterns

1. **Command Pattern (`ITest`)**: Each test case is a self-contained command object implementing `ITest` with an asynchronous `run()` method returning a normalized `TTestResult`.
2. **Dependency Injection (DI)**:
   - `UsuarioApiService` takes `HttpClient` and `baseUrl` via constructor.
   - Test instances receive `UsuarioApiService` and required parameters.
   - `TestRunner` receives `ConsolePrinter` to decouple logging from test flow.
3. **Facade / Gateway (`UsuarioApiService`)**: Encapsulates raw endpoint URLs and HTTP verb details away from test assertions.
4. **Data Transfer Object (`TUsuarioRequest`)**: Ensures strict typing for request bodies (`nombre`, `email`).

---

## 📁 Directory Structure

```text
.
├── bun.lock                     # Bun dependency lockfile
├── package.json                 # Project configuration and CLI scripts
├── tsconfig.json                # TypeScript compiler configuration
├── CLAUDE.md                    # Environment and coding guidelines
├── README.md                    # Project documentation
└── src/
    ├── app/                     # Test orchestration and reporting
    │   ├── SummaryReporter.ts   # Computes pass/fail rates and final tally
    │   └── TestRunner.ts        # Iterates and executes ITest test suites
    ├── core/                    # Core shared infrastructure
    │   ├── console/
    │   │   ├── ConsolePrinter.ts # Terminal formatted output helper
    │   │   └── TablePrinter.ts   # Formatted tabular console results
    │   ├── http/
    │   │   └── HttpClient.ts     # Wrapper around native fetch
    │   └── types/
    │       └── TTestResult.ts    # Standardized test result type definition
    ├── users/                   # Users domain module
    │   ├── dto/
    │   │   └── TUsuarioRequest.ts # DTO for create and update requests
    │   ├── interfaces/
    │   │   └── ITest.ts          # Contract for test execution
    │   ├── services/
    │   │   └── UsuarioApiService.ts # HTTP API client for /usuarios
    │   └── tests/               # Concrete test implementations
    │       ├── CreateUsuarioTest.ts # POST /usuarios test
    │       ├── DeleteUsuarioTest.ts # DELETE /usuarios/:id test
    │       ├── GetUserByIDTest.ts   # GET /usuarios/:id test
    │       ├── GetUsuariosTest.ts   # GET /usuarios test
    │       ├── InvalidRouteTest.ts  # GET /ruta-inexistente 404 test
    │       └── UpdateUsuarioTest.ts # PUT /usuarios/:id test
    ├── createUser.ts            # Single-run script: create user
    ├── deleteUser.ts            # Single-run script: delete user
    ├── getUserById.ts           # Single-run script: get user by ID
    ├── index.ts                 # Main test suite entrypoint
    ├── listUsers.ts             # Single-run script: list all users
    └── updateUser.ts            # Single-run script: update user
```

---

## 📦 Prerequisites

1. **Bun Runtime** installed on your system:
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```
2. **Target Microservice**: The Users API must be running (e.g. via Docker container or local server) at `http://localhost:3000`.

To install project dependencies:

```bash
bun install
```

---

## 🚀 Available Commands

You can run any command using `bun run <script>` or directly targeting the file with `bun run <file>`:

| Command | Action | Description |
|---|---|---|
| `bun run test:suite` | Run Test Suite | Executes all tests in `src/index.ts` with table and summary |
| `bun run start` | Alias for Suite | Runs the main test suite |
| `bun run users:list` | List Users | Calls `GET /usuarios` and prints JSON response |
| `bun run users:create` | Create User | Dispatches `POST /usuarios` with a new test user |
| `bun run users:get` | Get by ID | Calls `GET /usuarios/11` and prints result |
| `bun run users:update` | Update User | Calls `PUT /usuarios/11` and updates name and email |
| `bun run users:delete` | Delete User | Calls `DELETE /usuarios/13` and reports status |
| `bun run typecheck` | Typecheck | Runs `tsc --noEmit` to verify type safety |

---

## 💡 Usage Examples

### 1. Running the Full Test Suite

```bash
bun run test:suite
```

Direct file execution:

```bash
bun run src/index.ts
```

### 2. Running Individual Operations

Query all users:

```bash
bun run src/listUsers.ts
```

Register a new user:

```bash
bun run src/createUser.ts
```

### 3. Sample Terminal Output

When executing the suite (`bun run src/index.ts`), output is formatted in three stages:

```text
==================================================
🧪 INICIANDO TESTS
==================================================

✅ GET /usuarios
📊 Usuario creado: { id: 25, nombre: "Usuario Test", email: "test_1727480000@mail.com" }
✅ POST /usuarios
✅ GET /ruta-inexistente
✅ Usuario 1 Actualizado correctamente
✅ PUT /usuarios/:id
✅ Usuario 20 eliminado correctamente
✅ DELETE /usuarios/:id

┌───┬─────────────────────────┬────────┬──────────┬───────────┐
│   │ TEST                    │ STATUS │ ESPERADO │ RESULTADO │
├───┼─────────────────────────┼────────┼──────────┼───────────┤
│ 0 │ 'GET /usuarios'         │ 200    │ 200      │ '✅ OK'   │
│ 1 │ 'POST /usuarios'        │ 201    │ 201      │ '✅ OK'   │
│ 2 │ 'GET /ruta-inexistente' │ 404    │ 404      │ '✅ OK'   │
│ 3 │ 'PUT /usuarios/:id'     │ 200    │ 200      │ '✅ OK'   │
│ 4 │ 'DELETE /usuarios/:id'  │ 200    │ 200      │ '✅ OK'   │
└───┴─────────────────────────┴────────┴──────────┴───────────┘

==================================================
📊 RESUMEN FINAL
==================================================

✅ APROBADAS: 5

❌ FALLIDAS: 0

🧪 TOTAL: 5

==================================================
```

---

## ➕ Adding New Tests

To add a new test scenario, implement the `ITest` interface:

```typescript
import type { ITest } from "./users/interfaces/ITest";
import type { TTestResult } from "./core/types/TTestResult";
import { UsuarioApiService } from "./users/services/UsuarioApiService";

export class CustomUserTest implements ITest {
  constructor(private readonly api: UsuarioApiService) {}

  async run(): Promise<TTestResult> {
    const response = await this.api.getUsuarios();
    const data = await response.json();

    return {
      name: "GET /usuarios (Custom validation)",
      success: response.status === 200 && Array.isArray(data),
      status: response.status,
      expectedStatus: 200,
      response: data,
    };
  }
}
```

Then register your test in `src/index.ts`:

```typescript
const tests = [
  new GetUsuariosTest(apiService),
  new CustomUserTest(apiService),
  // ...
];
```
Historical snapshot (2026-09-30; the test count and command below are superseded by the current API integration suite documented later in this README):

```text
fix(compose): dev/prod split + frontend loop + clean backend compose
- .dockerignore (tests/), docker-compose.prod.yml (lean)
- Dockerfile CMD bun test (restart loop fixed)
- .env API_URL=01_rsc_wpm_bun_psgres-backend:4001 / docker-compose.yml depends_on
- _01_rsc_wpm_backend/docker-compose: remove frontend service (only postgres+backend)
- At that time, `docker compose run --rm frontend bun test` reported 4 pass.
```
---

## 📄 License

Private / Educational Project.

---

## 🏁 Onboarding — Quick Start (from session 2026-09-30 / rsc-web-picture-market)

**What this is:** CLI frontend test client (`_02_rsc_wp_frontend/`) + backend (`_01_rsc_wpm_backend/`) using Bun + PostgreSQL + Docker Compose.

**Directory layout (verified):**
```
_01_rsc_wpm_backend/  → backend (Bun + Postgres 16, port 4001)
_02_rsc_wp_frontend/ → frontend tests (Bun, bind mount .:/app, .env)
LEARNINGS/docker-microservices-containers-learnings.md  → session notes (fixed version, 187 lines)
local://docker-compose-dev-vs-prod-plan.md              → approved plan (same content)
local://paste-1.md                                      → tutorial (ConnectionRefused, .env, network)
```

**Environment (`_02_rsc_wp_frontend/.env`):** `API_URL=http://01_rsc_wpm_bun_psgres-backend:4001` (container-internal; local backend tests use `http://localhost:4001` when `API_URL` is unset).

**Key fixes applied:**
- `.dockerignore`: excludes `tests/` from prod image.
- `Dockerfile`: `CMD ["bun", "test", "./tests/usuarios.frontend.api.test.ts"]` (loop fixed — no `Restarting`).
- `docker-compose.prod.yml`: lean (no bind mount).
- `_01_rsc_wpm_backend/docker-compose.yml`: cleaned — only `postgres` + `backend` (removed `frontend` service that duplicated).
- Current network: `_02_rsc_wp_frontend/docker-compose.yml` joins the external `01_rsc_wpm_backend_rsc-network` created by the backend Compose project; the frontend `.env` hostname resolves over that shared network.

**Verified API test commands:**
```bash
# Start the API and its database (preserves the existing PostgreSQL volume).
cd _01_rsc_wpm_backend && docker compose up -d backend

# Run the backend API suite from inside the backend container.
cd .. && ./project-tools/container-management.sh test-backend --container

# Run the frontend API suite from inside the frontend test container.
./project-tools/container-management.sh test-frontend

# Run backend unit and API tests locally (uses localhost:4001 when API_URL is unset).
cd _01_rsc_wpm_backend && bun run test:all
```

**Verification checklist:**
- [ ] `docker compose ps` shows the backend and PostgreSQL healthy/running.
- [ ] Backend-container tests target `http://localhost:4001` from within that container.
- [ ] Frontend-container tests target the backend hostname in `.env`; an unreachable configured URL fails rather than falling back to localhost.
- [ ] Both API suites pass health, create, GET-by-ID, PUT/persistence, and DELETE/post-delete checks.
- [ ] Postgres `wpm_db` online (`pg_isready -U admin -d wpm_db`); table `usuario` exists.
- [ ] `.dockerignore` excludes `tests/`; `docker build .` produces lean image (no `tests/` in `docker images` layer).

**Reference links:**
- Plan / durable copy: `local://docker-compose-dev-vs-prod-plan.md`
- Tutorial (original, now updated by `LEARNINGS/...`): `local://paste-1.md`
- Current container/API test findings and counts: `LEARNINGS/docker-microservices-containers-learnings.md`, section 6.

**Notes:**
- `./project-tools/container-management.sh test-frontend` creates a temporary frontend test container on the Compose network and uses its configured `API_URL`.
- The backend production image excludes the test source; `test-backend --container` copies the backend API test file into the running container temporarily, executes it there, then removes it.
- If `GET /usuarios` returns `500` in backend test: server crash at endpoint (code/DB state issue, separate from docker/network — verify DB connection `DB_HOST=postgres`, table `usuario` exists).
---
A POSIX-compliant bash script (`project-tools/container-management.sh`) for managing the full container lifecycle. It wraps `docker compose` and `docker` commands to avoid common mistakes that caused errors during this project:

- **`start-all`**: Builds and starts the backend, then starts the frontend service on the external backend Compose network with `.env` pointing to `01_rsc_wpm_bun_psgres-backend:4001`. Uses `--no-deps` for frontend so it connects to the running backend directly, not a duplicate backend.
- **`stop-all`**: Stops both `backend` and `frontend` services (`docker compose stop`) and also any standalone `02_rsc_wp_bun_vue_frontend` container (`docker stop`).
- **`remove-all`**: Stops and removes (`docker rm -f`) all running containers — clean slate before a new build/restart.
- **`rebuild-all`**: Full cycle — builds backend (`build backend`), builds/rebuilds frontend (`build --no-cache frontend`); restarts backend first, then frontend (handles service rename `bun_app` → `backend` in compose). Confirms both `Up` via `docker ps`.
- **`test-frontend`**: Runs `docker compose -f _02_rsc_wp_frontend/docker-compose.yml run --rm frontend bun test ./tests/usuarios.frontend.api.test.ts`. It uses the `API_URL` hostname on the shared Compose network; an unreachable configured host fails instead of silently switching to localhost.
- **`test-backend --container`**: Runs backend unit tests locally, then copies and executes the API integration suite inside the running backend container.
- **`help`**: Shows all actions and brief descriptions.

Requires: `docker compose`, `docker ps`, `.env` (`API_URL=http://01_rsc_wpm_bun_psgres-backend:4001` — never `localhost` inside the frontend container), `.dockerignore` (`tests/` excluded from image), and the external network configured in `_02_rsc_wp_frontend/docker-compose.yml` to match the backend Compose network. The test service uses `restart: "no"` because it exits after running tests; a future persistent Vue server would need a server `CMD` and an appropriate restart policy. Without the shared network, the backend hostname cannot resolve or connect.
