# Persistent repository TODO list

## Intent
Keep actionable follow-up work visible across agent sessions and contributors by recording it in a tracked repository file instead of only in session memory.

## Scope
In scope: create a root `TODO.md`, move the outstanding health-check 503 test task into it, explain how future work is added and completed, and link the file from the root README.

Out of scope: implementing the listed health-check test or changing application code.

## Checklist
- [x] Create a tracked root TODO list with the pending 503 test task and clear completion criteria; verify its content.
- [x] Link the TODO list from the root README; verify the link target and rendered path.

## Evidence
- `TODO.md` now contains the pending 503 test work, acceptance criteria, and maintenance rules for future sessions.
- The root README links to `TODO.md` in its further-documentation table; `test -f TODO.md` and `git diff --check` passed.

## Next
The persistent TODO list is ready for future contributors, agents, and sessions.
