# Learning notes audit — 2026-10-02

## Intent
Review every file in `LEARNINGS/` and record reusable lessons from today's verified implementation and documentation work without replacing useful historical incident evidence.

## Scope
In scope: inspect all current learning notes; correct factual drift that could mislead future agents; add the persistent TODO/backlog and today's API integration findings where relevant; make current guidance discoverable from the root README.

Out of scope: rewrite unrelated Git/security guidance, alter application code, or duplicate complete API test documentation across every learning note.

## Checklist
- [x] Review every file in `LEARNINGS/` and identify stale claims relevant to today's work; verify paths/commands against current project configuration.
- [x] Update reusable Docker/PostgreSQL notes with today's verified API testing/network/health findings and keep old outcomes clearly historical.
- [x] Add the cross-session TODO workflow to the appropriate project documentation; ensure `TODO.md` remains linked.
- [x] Run documentation consistency checks (`git diff --check`, targeted stale-claim search, and relative-link verification where practical).

## Evidence
- Reviewed all four files in `LEARNINGS/`: Docker/container, PostgreSQL, Git/GitHub, and new-project/security practices.
- Confirmed current backend/frontend Compose topology from their Compose files and current API test workflow in the root README, both subproject READMEs, and the API integration FTD record.
- Found historical Docker notes recommending an obsolete `rsc-shared` setup and old `4 pass` test counts; these remain labeled as snapshots and the current Compose network/workflow is stated separately.
- Found the new-project guide recommending a root README even though one now exists, and historical security checkboxes that could be read as current. The guide needs a current-status note and those claims need explicit historical scope.
- The backend Compose file currently contains development database credentials inline. The root README already warns about this; `TODO.md` now tracks externalization and rotation with verification criteria.
- Updated the project/security guide to mark the root README recommendation complete and to label old CI, test, and security claims as historical rather than current evidence.
- `TODO.md` tracks both the untested `/health` 503 branch and credential externalization/rotation.

## Verification
- `git diff --check` passed.
- Targeted search confirmed old test counts and network examples remain only in clearly labeled historical sections; current commands and results are documented separately.
- Relative Markdown links in the changed learning notes, root README, and backlog resolve to existing files.
