# Schema-introspection modes for db-healthcheck

## Intent

`project-tools/db-healthcheck.sh` can run arbitrary queries (`-q`/`--file`) and a health
suite, but has no structured way to discover the schema. Add three single-intent,
machine-readable modes so the tool can answer "what database am I on?", "what base tables
exist in the schema?" and "what fields does this table have?" with one flag each, without
remembering catalog SQL. Tracks GitHub issue #33.

## Scope

- `project-tools/db-healthcheck.sh` only (plus this FTD record and the TODO.md entry).
- New flags: `--db-name`, `--tables`, `--columns <table>`.
- Not in scope: view listing, row counts per table, `--describe` aliases, or dropping the
  dead `sql_display()` helper (that has its own TODO item).

## Checklist

- [x] Issue #33 created; branch `feat/dev-db-healthcheck-introspection` cut from `origin/dev`.
- [x] The three SQL statements probed live (2026-10-08): `current_database()` → `wpm_db`;
      `information_schema.tables` (`table_type='BASE TABLE'`) → `usuario`;
      `information_schema.columns` for `usuario` → 3 rows, `ordinal_position` order.
- [x] New flags implemented, mutually exclusive with `--check`/`-q`/`--file` (MODES
      arbitration extended), usage/help updated, dispatch routed.
- [x] `--columns` validates the table with `to_regclass` and fails with
      `Table '<schema>.<table>' does not exist.` when missing; fails with an actionable
      message when the argument is omitted.
- [x] Container requirement enforced through the existing `require_container_for_queries`.
- [x] Acceptance runs observed (see Evidence): `--db-name`, `--tables`, `--columns usuario`,
      `--columns nope`, `--columns` (no arg), mixed-mode rejection, `bash -n`,
      full-suite regression 8/8 in PTY and non-TTY.

## Evidence

- `./project-tools/db-healthcheck.sh --db-name` → `wpm_db`, exit 0.
- `./project-tools/db-healthcheck.sh --tables` → `usuario`, exit 0.
- `./project-tools/db-healthcheck.sh --columns usuario` →
  ```
  id|integer||NO
  nombre|character varying|100|NO
  email|character varying|100|NO
  ```
  exit 0.
- `./project-tools/db-healthcheck.sh --columns nope` → exit 1,
  `Error: Table 'public.nope' does not exist.`
- `./project-tools/db-healthcheck.sh --columns` → exit 1, `--columns requires a table name.`
- `./project-tools/db-healthcheck.sh --tables -q 'SELECT 1'` → exit 1,
  `Choose one mode: --check, -q/--query, --file, --db-name, --tables, or --columns (they cannot be combined).`
- `bash -n project-tools/db-healthcheck.sh` → clean (`#!/usr/bin/env bash` required).
- Regression: full suite under a PTY (`script -qec …`) → 8/8 PASS, exit 0, real ESC bytes,
  no literal `\033`; non-TTY (`< /dev/null`) → 8/8 PASS, exit 0, colors stripped.
- Parseable from scripts: `name=$(./project-tools/db-healthcheck.sh --db-name)` → `wpm_db`.

## Next step

- TODO.md entry for this feature moves to **Completed** with the acceptance evidence.
- Future (optional): row-count column for `--tables` or a `--describe <table>` psql-style
  alias — not accepted now, keep the tool single-intent.