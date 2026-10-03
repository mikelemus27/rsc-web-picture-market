# Shared API contract tests

## Intent
Reduce duplicated API test setup and assertions between the backend and frontend subprojects while preserving independent test runs from each container. Each run must verify the API is reachable from that container's network perspective.

## Scope
In scope: share the common API contract checks and test configuration; retain separate backend-container and frontend-container test commands; document how to run both.

Out of scope: frontend rendering or unit tests, backend internals/unit tests, changes to application behavior, and automatic orchestration of the whole stack.

## Checklist
- [ ] Define the expected API outcomes for user creation, including duplicate-user behavior; verify that unexpected server errors such as HTTP 500 fail the contract test.
- [ ] Extract the duplicated API contract assertions and common setup into one shared test source accessible to both subprojects.
- [ ] Preserve independent execution from the backend container, targeting the API through that container's local endpoint.
- [ ] Preserve independent execution from the frontend test container, targeting the backend through the Compose network; verify name resolution and connectivity from inside that container.
- [ ] Keep distinct commands for running the contract suite from each container, and retain any useful local test mode.
- [ ] Update test-related documentation with the available commands, required services, and what each container run verifies.
- [ ] Run the backend-container and frontend-container test commands independently; record each result and confirm both execute the shared assertions.

## Evidence
- Not started. No implementation or tests were run for this refactor.
- Existing backend and frontend API tests were inspected; both currently duplicate API URL resolution and check the same four endpoints. Their create-user assertions currently permit HTTP 500, which should not be preserved without an explicit contract reason.
- Current Compose configuration places frontend and backend on a shared network, but the proposed shared-test-source visibility and frontend-to-backend address must be verified during implementation.

## Next
When this refactor is prioritized, first settle the intended create-user status contract, then implement the shared test source while keeping separate container entry points and proving connectivity from each container.
