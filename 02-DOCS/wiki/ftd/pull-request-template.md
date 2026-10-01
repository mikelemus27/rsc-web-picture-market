# Pull request template

## Intent
Add a repository-level pull request template so future PRs consistently explain their purpose, scope, validation, and review needs.

## Scope
Create `.github/pull_request_template.md`. Do not rewrite or update an existing pull request.

## Checklist
- [x] Add a concise template with change summary, rationale/decisions, validation, review checklist, and optional issue links.
- [x] Verify the template structure, placeholders, and diff whitespace.

## Evidence
- Added `.github/pull_request_template.md` with the six planned sections and HTML comment prompts.
- A structural check confirmed all sections and balanced placeholders; `git diff --check` passed.

## Next
Use the template for future pull requests.
