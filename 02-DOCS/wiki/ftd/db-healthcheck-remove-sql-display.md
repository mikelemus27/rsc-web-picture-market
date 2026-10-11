# Remove dead sql_display() helper from db-healthcheck

## Intent

`project-tools/db-healthcheck.sh` defines `sql_display()` (the loose psql print variant) but
nothing ever calls it; the live query paths are `run_guarded` + `sql_value` (raw, unaligned,
`-q -t -A`). Keeping a second, unexercised SQL path invites drift: a future edit changes the
plain print instead of the raw one, or the container/stdin quirks get fixed twice. Remove it
so the script has exactly one SQL execution path. Tracks GitHub issue #41.

## Scope

- `project-tools/db-healthcheck.sh` only: delete the helper (comment + function).
- `02-DOCS/wiki/ftd/db-healthcheck-remove-sql-display.md` (this record) and the `TODO.md` entry.
- Not in scope: `run_guarded`, `sql_value`, `check_pg_ready`, the health checks, the query
  modes, or the credential-resolution block.

## Checklist

- [x] Issue #41 created; branch `chore/dev-remove-dead-sql-display` cut from `origin/dev`.
- [x] Confirmed dead before touching: `grep -rn sql_display` shows the definition in
      `db-healthcheck.sh` only; the remaining matches are this TODO item and the FTD records
      for `db-healthcheck-introspection` and `db-healthcheck-tty-hang-colors` (historical
      notes, left untouched).
- [x] Helper removed (comment + function).
- [x] `bash -n` clean.
- [x] Full health suite passes 8/8 against the live stack (see Evidence).

## Evidence

- `grep -n sql_display project-tools/db-healthcheck.sh` → no matches (function removed).
- `bash -n project-tools/db-healthcheck.sh` → clean (`#!/usr/bin/env bash` required).
- Full suite `./project-tools/db-healthcheck.sh` (stack up: `01_rsc_wpm_backend-postgres`
  Up healthy, backend Up) →
  ```
  [ PASS ] container     203ms  Status: Up 40 minutes (healthy)
  [ PASS ] health        264ms  Health: healthy
  [ PASS ] pg_ready      308ms  /var/run/postgresql:5432 - accepting connections
  [ PASS ] db_size       369ms  Size of 'wpm_db': 7639 kB
  [ PASS ] table         349ms  Table resolves to: usuario
  [ PASS ] schema        434ms  All 3 required columns present with expected types (extra columns ignored).
  [ PASS ] constraints  1423ms  PK on id, UNIQUE on email, NOT NULL on nombre email (extra constraints ignored).
  [ PASS ] data          333ms  Rows in 'usuario': 3

  8/8 checks passed
  ```
  exit 0.

## Next step

- TODO.md entry for this item moves to **Completed** with the acceptance evidence.
- After merge on `dev`: fast-forward the branch, re-run the suite once more post-merge
  (canonical verification per project convention), then delete the branch.
- The harness auto-update churn (rsc 3.0.12 → 3.0.18, same-major background sync) observed
  during this change is separate from this item and is parked in a stash for a follow-up
  decision.