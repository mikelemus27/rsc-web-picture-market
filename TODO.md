# TODO

This file is the persistent backlog for follow-up work in this repository. Use it across contributors, agents, and sessions; session-local task lists are not a substitute for this tracked file.

## Open

- [ ] **Test the health-check failure response.** Extract the `/health` response logic behind an injectable database probe if needed. Add a focused unit test that makes the probe reject and asserts HTTP 503, `{ "status": "unavailable" }`, and error logging. Keep the healthy 200 test passing. Do not stop or modify the live PostgreSQL container to simulate the failure. Done when the test fails if the unavailable response or logging is removed, and passes with the intended behavior.
- [ ] **Externalize and rotate database credentials.** Remove inline development database credential values from the backend Compose configuration and load them from ignored local environment configuration or an appropriate secret store. Rotate any credential that was previously exposed; rewriting Git history does not invalidate it. Verify Compose still starts with documented setup, confirm the secret source is excluded from Git, and scan the current tracked files for credential literals without reproducing secret values in docs or logs.

## Backlog maintenance

- Add a checkbox item when follow-up work is identified but is not being implemented in the current change.
- Write each item so a future contributor can understand the goal and how to verify completion without relying on chat history.
- Remove or mark an item complete only after its acceptance criteria have been implemented and verified. Record relevant test evidence in the corresponding change or feature documentation.
- Review this file at the start of repository work and update it when completing or discovering follow-up work.
