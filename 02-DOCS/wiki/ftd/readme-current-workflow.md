# Document current project workflows in the README

## Intent
Update the root README to describe the verified PostgreSQL schema setup, test commands, and current container-management actions without repeating stale environment or security claims.

## Scope
Correct README guidance directly affected by the recent database initialization and container-management work. Preserve the existing project overview and architecture description, but align setup, test, security, and container command sections with current files.

## Checklist
- [x] Document PostgreSQL schema initialization and distinguish new from existing data volumes; checked against Compose and SQL files.
- [x] Document current backend/frontend test commands and database prerequisites; checked against script help and package scripts.
- [x] Document project-scoped stop versus global stop, including global confirmation and scope; verified against CLI help and script behavior.
- [x] Correct stale port/security/configuration claims related to these workflows; README writing check, local-link check, placeholder scan, and `git diff --check` passed.

## Evidence
`technical-writing/scripts/verify.sh README.md` → PASS. README-relative Markdown links all resolve; no placeholder text remains; `git diff --check` passes. The action names and global stop confirmation are present in the actual `container-management.sh` help output.

## Next
Review and commit the README update when desired. No application code or runtime configuration was changed in this README task.
