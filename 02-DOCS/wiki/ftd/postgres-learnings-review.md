# PostgreSQL learning notes review

## Intent
Review existing `LEARNINGS` documents for reusable PostgreSQL/Docker lessons from the recent database-schema failure and preserve those lessons in a dedicated PostgreSQL reference.

## Scope
Review all existing Markdown files in `LEARNINGS/`. Add a focused PostgreSQL learning document and link the confirmed Compose/schema incident from the Docker learning document. Avoid broad rewrites of historical notes beyond directly relevant corrections.

## Checklist
- [x] Review each current learning document and identify reusable, evidence-backed lessons. Reviewed the Git/GitHub, Docker Compose, and project/security learning documents.
- [x] Create `LEARNINGS/postgresql-learnings.md` with verified guidance on schema initialization, readiness, persistent volumes, test diagnostics, assertion quality, and credential hygiene.
- [x] Add a short incident summary and cross-reference to the Docker learning document; validate changed Markdown for consistency and links.

## Evidence
Initial review identified three existing learning documents. Both API suites had failed because the `usuario` relation was missing; backend logs showed `42P01` and `psql \dt` returned no relations. Creating the table yielded 4/4 passing tests in each suite.

The Docker notes now record the incident and link to the PostgreSQL reference. Historical Docker/security claims are labeled as snapshots; previously exposed credential text was removed from the learning notes, and a stale PR-template tracking statement was corrected after checking Git tracking.

`technical-writing/scripts/verify.sh` passed for all four learning documents. `git diff --check`, local Markdown link checks, and a scan confirming the previously exposed credential string is absent from `LEARNINGS/` passed.

## Next
Review the new PostgreSQL reference; no code or database changes are included in this documentation task.
