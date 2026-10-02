# Stop running containers

## Intent
Add a guarded option to stop every currently running Docker container when explicitly requested.

## Scope
The new action applies to all containers in the active Docker context, including containers outside this repository. It only stops containers; it does not remove containers, volumes, images, or networks. Existing `stop-all` remains scoped to this project.

## Checklist
- [x] Add and document a separate global stop action; verified by reviewing the usage output and keeping the existing `stop-all` project-scoped.
- [x] Require an interactive confirmation after displaying the running containers; a mocked Docker CLI verified non-interactive refusal and cancellation do not stop any container.
- [x] Stop the captured set of running container IDs only after confirmation; the mock verified that only the displayed IDs were passed to `docker stop`, and the empty-list and Docker-listing-error paths did not stop anything. `sh -n project-tools/container-management.sh` and `git diff --check` passed.

## Evidence
The mocked Docker behavior test passed for non-interactive refusal, confirmation cancellation, confirmed stop of the captured IDs only, empty running-container list, and Docker listing failure. No real containers were stopped during verification.

## Next
Ready for review; real global stop execution remains intentionally untested because it would interrupt running containers in the active Docker context.
