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

## ✨ Key Features

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
