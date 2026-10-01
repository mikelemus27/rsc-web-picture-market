# Tracking shared GitHub assets

## Intent
Record practical guidance for versioning GitHub templates, project instructions, and agent skills without committing machine-local integration state.

## Scope
Update `LEARNINGS/git-github-gh-commands-best-practices.md` with rules and repository examples for shared source files versus generated or personal files.

## Checklist
- [x] Add guidance on templates and shared project rules; verify it names the default-branch requirement.
- [x] Distinguish canonical skill sources from generated editor links and local harness state.
- [x] Validate the learning document and its links/paths.

## Evidence
The new section now covers issue/PR templates, shared instructions, skill provenance, generated editor wiring, and the need to inspect and stage exact paths.
- `technical-writing/scripts/verify.sh LEARNINGS/git-github-gh-commands-best-practices.md` passed.
- `git diff --check` passed; checks confirmed the documented template and skill paths exist.

## Next
Use these checks before committing shared templates or installed skills.
