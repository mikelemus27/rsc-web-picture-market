# Explain Frontend Compose Test Output

## Intent
Add a reusable explanation of the frontend API test command and its observed Docker output to the microservices learning guide.

## Scope
- In scope: explain the Compose command, remote API selection, Docker networking, test results, and the POST test's accepted statuses.
- Out of scope: changing application code or test behavior.

## Checklist
- [x] Add the explanation to the Docker learning guide — verified by inspecting the updated section.

## Evidence
- `LEARNINGS/docker-microservices-containers-learnings.md` now explains each command segment, the backend container hostname, all four test outcomes, and the caveat that POST can pass on a `500` response.

## Next
- Continue using the guide when running or troubleshooting the frontend container tests.
