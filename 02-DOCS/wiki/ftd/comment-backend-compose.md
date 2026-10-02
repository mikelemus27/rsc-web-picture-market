# Comment backend Compose configuration

## Intent
Add concise, maintainable comments to the backend Compose file so contributors can understand service roles, database setup, and container networking.

## Scope
Comment `_01_rsc_wpm_backend/docker-compose.yml` only. Preserve service settings and behavior. Explain persistent database storage, first-volume schema initialization, health-based startup ordering, and host-versus-container ports.

## Checklist
- [x] Add a file overview and comments to the PostgreSQL, backend, volume, and network sections; preserved the Compose values present before this task.
- [x] Validate Compose syntax and review the final diff; `docker compose config --quiet` and `git diff --check` passed.

## Evidence
Comments explain service roles, host/container ports, persistent data, first-volume schema initialization, readiness ordering, and development credential handling. The Compose file already had uncommitted configuration edits before this task; those were retained unchanged.

## Next
Review the comments; no service configuration was intentionally changed in this task.
