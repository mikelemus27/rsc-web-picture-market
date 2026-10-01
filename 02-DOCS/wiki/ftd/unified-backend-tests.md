# Unified backend tests

## Intent
Provide one Bun/TypeScript command for running backend API tests locally or inside the running Compose backend container.

## Scope
Backend integration tests only. The container mode uses the configured Docker Compose context and mounts test sources read-only; frontend tests and automatic service startup are out of scope.

## Checklist
- [x] Add a TypeScript Bun runner with local and container modes; verified with runner help and a local test run (4 passed).
- [x] Expose the runner through the backend package script and copy the test file into the running Compose container; verified with Compose config and container test execution (4 passed). Runtime copying supports Docker contexts where the daemon host does not share the local checkout.
- [x] Document both invocations in the root README backend test instructions; verified by reviewing the changed instructions.

## Evidence
- `bun run test:all` — 4 passed locally against `http://localhost:4001`.
- `bun run test:all -- --help` — shows local and container commands.
- `bun run test:all -- --container` — 4 passed inside the running Compose backend; the copied test file was removed afterward.
- `docker compose config --quiet` — passed after final Compose changes.

## Next
None — implementation and both test modes are verified.
