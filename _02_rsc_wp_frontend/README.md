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

**Current state (CLI test client)**: The container runs `bun test` (via `Dockerfile` `CMD`) and exits cleanly after the suite (`4 pass / 0 fail`). It does **not** stay running (`restart: "no"` in `docker-compose.yml`) because this frontend is only a test harness fetching the backend API (`http://01_rsc_wpm_bun_psgres-backend:4001`).

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
- **Complete CRUD Test Coverage**:
  - `GET /usuarios`: Verifies listing all users (Status 200).
  - `GET /usuarios/:id`: Verifies querying a single user by primary identifier (Status 200).
  - `POST /usuarios`: Verifies user registration with dynamic timestamped payloads (Status 201).
  - `PUT /usuarios/:id`: Verifies user record updates and response validation (Status 200).
  - `DELETE /usuarios/:id`: Verifies deletion and status handling (Status 200 / 404).
  - `GET /ruta-inexistente`: Verifies server 404 fallback behavior on unmapped routes.
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
30092026
fix(compose): dev/prod split + frontend loop + clean backend compose

- .dockerignore (tests/), docker-compose.prod.yml (lean)
- Dockerfile CMD bun test (restart loop fixed)
- .env API_URL=01_rsc_wpm_bun_psgres-backend:4001 / docker-compose.yml depends_on
- _01_rsc_wpm_backend/docker-compose: remove frontend service (only postgres+backend)
- Verified: docker compose run --rm frontend bun test → 4 pass
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

**Environment (`_02_rsc_wp_frontend/.env`):** `API_URL=http://01_rsc_wpm_bun_psgres-backend:4001` (container-internal; host tests use `localhost:4001` via override).

**Key fixes applied:**
- `.dockerignore`: excludes `tests/` from prod image.
- `Dockerfile`: `CMD ["bun", "test", "./tests/usuarios.frontend.api.test.ts"]` (loop fixed — no `Restarting`).
- `docker-compose.prod.yml`: lean (no bind mount).
- `_01_rsc_wpm_backend/docker-compose.yml`: cleaned — only `postgres` + `backend` (removed `frontend` service that duplicated).
- Network: `rsc-shared` shared bridge (`docker network create rsc-shared`); both on same network → `ConnectionRefused` resolved.

**Prverified commands (use these first, not guesses):**
```bash
# 1. Start backend (must be running for frontend)
cd _01_rsc_wpm_backend && docker compose up -d backend

# 2. Run frontend tests (verified 4 pass / 0 fail / ~82ms)
docker compose -f ../_02_rsc_wp_frontend/docker-compose.yml run --rm frontend bun test ./tests/usuarios.frontend.api.test.ts

# 3. Interactive / live (after `docker start 02_rsc_wp_bun_vue_frontend` if exited)
docker exec -it 02_rsc_wp_bun_vue_frontend bun test ./tests/usuarios.frontend.api.test.ts

# 4. Direct host test (backend test, container excludes source)
cd _01_rsc_wpm_backend && bun test ./test/usuarios.api.test.ts   # 4 pass / 2 fail (GET 500 + POST format)
```

**Verification checklist:**
- [ ] `docker ps` shows `01_rsc_wpm_bun_psgres-backend` (`Up`) and `02_rsc_wp_bun_vue_frontend` (`Up` — not `Restarting`).
- [ ] `docker logs 02_rsc_wp_bun_vue_frontend` shows `bun test` result, not crash loop.
- [ ] `.env` points to `01_rsc_wpm_bun_psgres-backend:4001` (not `localhost`).
- [ ] `docker compose run --rm frontend bun test` passes (4 pass) before calling done.
- [ ] Postgres `wpm_db` online (`pg_isready -U admin -d wpm_db`); table `usuario` exists.
- [ ] `.dockerignore` excludes `tests/`; `docker build .` produces lean image (no `tests/` in `docker images` layer).

**Reference links:**
- Plan / durable copy: `local://docker-compose-dev-vs-prod-plan.md`
- Tutorial (original, now updated by `LEARNINGS/...`): `local://paste-1.md`
- Session notes (rebuilt, complete): `LEARNINGS/docker-microservices-containers-learnings.md`

**Notes:**
- `docker compose run --rm frontend bun test` uses the compose `rsc-network`; `docker exec` on a standalone container needs that same network (`rsc-shared` or `external: true` with `name: 01_rsc_wpm_backend_rsc-network`).
- Backend test (`bun test`) runs at host because multi-stage `Dockerfile` (`production` stage) only includes `dist/`; `tests/` excluded by `.dockerignore`.
- If `GET /usuarios` returns `500` in backend test: server crash at endpoint (code/DB state issue, separate from docker/network — verify DB connection `DB_HOST=postgres`, table `usuario` exists).
---
## 🛠 Project Tools

A POSIX-compliant bash script (`project-tools/container-management.sh`) for managing the full container lifecycle without typing long compose commands:

- `start-all`: builds backend (`_01_rsc_wpm_backend/docker-compose.yml`), starts backend (`01_rsc_wpm_bun_psgres-backend`); builds/restarts frontend (`_02_rsc_wp_frontend/docker-compose.yml` with `.env` pointing to `http://01_rsc_wpm_bun_psgres-backend:4001`, `rsc-shared` network, bind mount `.:/app`, `restart: "no"` to prevent loop). Uses `docker compose up -d` with `--no-deps` for frontend.
- `stop-all`: stops both backend and frontend containers (`docker compose stop` + `docker stop`).
- `remove-all`: stops and removes all running containers (`docker rm -f`), giving a clean slate.
- `rebuild-all`: rebuilds images (`docker compose build backend`; `docker compose build --no-cache frontend`) then restarts in order (backend first, frontend second). Handles the case where `bun_app` service name changed to `backend` in compose files.
- `test-frontend`: runs `docker compose -f _02_rsc_wp_frontend/docker-compose.yml run --rm frontend bun test ./tests/usuarios.frontend.api.test.ts` (verified: 4 pass, 0 fail, ~166ms; uses compose network so `.env` hostname resolves to backend).
- `test-backend`: changes to `_01_rsc_wpm_backend/` and runs `bun test ./test/usuarios.api.test.ts` (verified: 4 pass, 0 fail, ~72ms; note: multi-stage production `Dockerfile` excludes `tests/`, so backend tests must run at host source or via bind-mount — not inside production image).
- `help`: lists all actions with descriptions.

Requires: `docker compose`, `docker ps`, `.env` (`API_URL=http://01_rsc_wpm_bun_psgres-backend:4001`), `.dockerignore` (`tests/` excluded from image), `Dockerfile` (`CMD ["bun", "test", ...]` ensures clean exit — loop prevented by `restart: "no"` in compose, not by missing CMD), and shared `rsc-shared` network (`docker network create rsc-shared` or `external: true` with `name: 01_rsc_wpm_backend_rsc-network`). Without shared network, container hostname `01_rsc_wpm_bun_psgres-backend` fails (`ConnectionRefused` / `FailedToOpenSocket`).

Note: The container loop (`Restarting (1)`) was caused by `restart: unless-stopped` combined with `CMD bun test` — the test exits 0, Docker restarts, loop. Fix: `restart: "no"` in compose; `CMD bun test` stays (exit clean). If interactive server needed (Vue future), change `CMD` to persistent server (`bun run src/index.ts`) and restore `restart: unless-stopped`.
