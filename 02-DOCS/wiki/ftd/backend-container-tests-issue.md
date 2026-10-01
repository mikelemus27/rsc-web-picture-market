# Backend container test option

## Intent
Expose the backend test runner's existing container mode through `project-tools/container-management.sh` and track this script-level integration as a focused issue.

## Scope
Add and publish a reusable YAML feature-request form; create a focused issue for the script-level integration; add `test-backend --container` to invoke `bun run test:all -- --container`; document both modes in the root README. Preserve the existing local test command.

## Checklist
- [x] Add and publish the YAML form; verify it is present on the default branch.
- [x] Search all open and closed issues and classify relevant candidates against the form.
- [x] Follow the duplicate policy and verify the target-host result.
- [x] Create the focused issue for the unique missing script option and verify its target-host read-back.
- [x] Add the container option without changing default local behavior; verify both modes and run the backend tests inside Docker.
- [x] Document the root-level local and container commands and prerequisites in `README.md`; verify the examples match the script and runner.

## Evidence
- Ruby parsed the YAML form successfully; `git diff --check` passed.
- Published `.github/ISSUE_TEMPLATE/feature_request.yml` on `main` in commit `ee43d8a`; GitHub read-back returned the file on `main`.
- The open-and-closed search found issue #9, “Enable running tests locally and in remote container.” Closed PR #10 references #9 and describes backend test execution in a Compose container. Issue #9 predates the form and does not contain its required description heading.
- After user authorization, posted a repair-request comment to #9. Target-host read-back matched the comment and confirmed #9 remains closed with its labels unchanged: https://github.com/mikelemus27/rsc-web-picture-market/issues/9#issuecomment-5936475592.
- Created issue #11, “Expose backend container test mode in container-management.sh,” using the published feature-request form and existing `enhancement` label. Target-host read-back confirmed it is open with the expected title, body, and label.
- #9 describes container test execution generally, while #4 covers backend test refactoring; neither specifies the missing `container-management.sh` option. The precise script query had no matches.
- `sh -n project-tools/container-management.sh` and `git diff --check` passed; `shellcheck` is unavailable.
- Stubbed command tests confirmed `test-backend --container` invokes `bun run test:all -- --container`, default `test-backend` retains the original local command, and unknown options fail without invoking Bun.
- Ran `sh project-tools/container-management.sh test-backend --container` against the running Compose service: 4 tests passed, 0 failed.
- Updated the root `README.md` with both `project-tools/container-management.sh` commands, the running-service prerequisite, the container runner's test-file copy and URL behavior, and the verified container-test result.

## Next
Review and land the script change on its feature branch.
