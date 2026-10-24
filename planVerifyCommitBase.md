# Runbook: verify baseline commit `89bc61f`, then harden it

**Target commit:** `89bc61f` (2026-10-02) — *"test(api): verify CRUD contracts across containers"*.
**Repository:** `mikelemus27/rsc-web-picture-market` (**PUBLIC**).
**Main working tree:** `/home/mgl/AI-Agents-Tests/rsc-harness/rsc-web-picture-market`
**Worktree used below:** `../rsc-web-picture-market.worktrees/verify-89bc61f`

---

## 0. What this runbook proves, and what it does not

**Proves:** that `89bc61f`, built from its own Compose files and its own mounted init script, produces a healthy database and green suites — reproduce the numbers recorded in `02-DOCS/wiki/ftd/container-api-integration-coverage.md` at that commit.

**Does not prove:** that the commit is a safe rollback target, that its credentials are acceptable, or that later commits are green.

**Golden rule:** Phases A–E run against a **byte-identical tree**. The moment you edit a tracked file, the artifact under test is no longer `89bc61f` and the result must not be reported as the commit's status.

---

## 1. Facts already verified — do not re-derive

| Fact | Value |
|---|---|
| Root commit | `109ddc6` (2026-09-28), tagged `baseline/root-109ddc6` |
| Verified-baseline tag | `R-26BGestPSBaseok-verified-89bc61f` → `9736339` = `89bc61f` + 2 minimal commits |
| Existing worktree `baseline-check` | holds `9736339`, **not** raw `89bc61f` — do not reuse it |
| Init schema | `_01_rsc_wpm_backend/db/init/01-schema.sql` is **identical** at `89bc61f` and `HEAD` |
| Backend container name | `01_rsc_wpm_bun_psgres-backend`, hardcoded via `container_name:` in **both** revisions |
| Postgres service name at `89bc61f` | no explicit `container_name:` → safe to namespace with `-p` |
| Credentials at `89bc61f` | hardcoded in compose: `POSTGRES_USER: admin`, `POSTGRES_PASSWORD: admin123`, DB `wpm_db` |
| `.env` at `89bc61f` | **tracked** in git (its own header claims otherwise) |
| `.gitignore` line 7 at `89bc61f` | `.env .env.local .env.production` — one broken pattern, matches nothing |
| Expected backend result | 16 pass / 0 fail / 36 assertions (`bun run test:all`) |
| Expected frontend result | 11 pass / 28 assertions |
| Superuser role | `admin` (there is no `postgres` role) |
| Local socket auth | `trust` — passwordless `psql` inside the container |

---

## 2. Phase A — create the worktree at the exact commit

```bash
cd /home/mgl/AI-Agents-Tests/rsc-harness/rsc-web-picture-market

git worktree add --detach \
  ../rsc-web-picture-market.worktrees/verify-89bc61f \
  89bc61f
```

`--detach` is mandatory: it prevents Git from attaching a branch to a historical commit.

**Prove identity before touching Docker:**

```bash
cd ../rsc-web-picture-market.worktrees/verify-89bc61f
git rev-parse HEAD
git rev-parse 89bc61f          # both lines must print the SAME full sha
git log -1 --format='%H %ad %s' --date=iso
git status --short             # must be EMPTY
```

Record the full sha in the evidence file. If the two `rev-parse` lines differ, stop.

---

## 3. Phase B — record state, then free the container names

The baseline Compose stack and the running dev stack share the backend container name. They cannot coexist.

**Record first (so you can restore later):**

```bash
cd /home/mgl/AI-Agents-Tests/rsc-harness/rsc-web-picture-market
docker ps --format '{{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -E 'rsc|wpm'
ss -ltnp | grep -E ':(4001|5432)\b'
docker volume ls --format '{{.Name}}' | grep -i -E 'rsc|wpm|postgres'
```

**Then stop the live stack** (this interrupts your working environment):

```bash
./project-tools/container-management.sh stop-all
```

Raw fallback if that subcommand is unavailable (full command reference: Appendix A):

```bash
docker stop 01_rsc_wpm_bun_psgres-backend 01_rsc_wpm_backend-postgres
```

Confirm ports are free before continuing:

```bash
ss -ltnp | grep -E ':(4001|5432)\b' || echo 'ports free'
```

---

## 4. Phase C — start the baseline stack on a fresh volume

Use an explicit project name. Two reasons: the volume becomes predictable, and the postgres container gets a unique name that cannot collide.

```bash
cd ../rsc-web-picture-market.worktrees/verify-89bc61f/_01_rsc_wpm_backend

docker compose -p verify-base-89bc61f config | head -5
```

**Gate:** the rendered `name:` must be `verify-base-89bc61f`. If it is not, stop and fix the invocation.

```bash
docker compose -p verify-base-89bc61f up -d --build
docker compose -p verify-base-89bc61f ps
docker volume ls --format '{{.Name}}' | grep verify-base-89bc61f
```

**Gate:** a volume named `verify-base-89bc61f_postgres_data` must now exist. If the stack instead attaches `01_rsc_wpm_backend_postgres_data`, you are reusing the dev data and the verification is void — stop and investigate.

**Health check — this is the database proof:**

```bash
curl -s http://localhost:4001/health
# expect: {"status":"ok"}
```

A `503` or a connection error means the schema or credentials did not initialize. Do not proceed to tests.

Optional independent confirmation (the commit has no `db-healthcheck.sh` yet):

```bash
docker exec -it verify-base-89bc61f-postgres-1 \
  psql -U admin -d wpm_db -c '\dt'
# expect the usuario table to be listed
```

---

## 5. Phase D — run the suites and record evidence

Backend, full suite (unit + API integration against `http://localhost:4001`):

```bash
cd ../rsc-web-picture-market.worktrees/verify-89bc61f/_01_rsc_wpm_backend
bun install --frozen-lockfile
bun run test:all 2>&1 | tee /tmp/evidence-89bc61f-backend.log
```

Expected: **16 pass, 0 fail, 36 assertions**.

Server-free subset, useful to separate DB problems from code problems:

```bash
bun run test:unit 2>&1 | tee /tmp/evidence-89bc61f-unit.log
```

Frontend suite. Check what the script actually supports at this commit before guessing:

```bash
cd ../rsc-web-picture-market.worktrees/verify-89bc61f
sed -n '1,40p' _02_rsc_wp_frontend/package.json
./project-tools/container-management.sh --help
```

If `test-frontend` exists:

```bash
./project-tools/container-management.sh test-frontend 2>&1 | tee /tmp/evidence-89bc61f-frontend.log
```

Direct fallback from the host:

```bash
cd _02_rsc_wp_frontend
bun install --frozen-lockfile
API_URL=http://localhost:4001 bun test tests/usuarios.frontend.api.test.ts \
  2>&1 | tee /tmp/evidence-89bc61f-frontend.log
```

Expected: **11 pass, 28 assertions**.

**Do not fix failures in this phase.** Record them verbatim. A genuine failure is a result, not an obstacle.

---

## 6. Phase E — known defect in this commit

The backend `package.json` at `89bc61f` ends with stray non-JSON text after the closing brace (removed much later in `c4378d5`).

```bash
tail -3 _01_rsc_wpm_backend/package.json | cat -A
```

- If `bun run ...` works, note it and continue.
- If Bun rejects the file, run the tests by explicit path (`bun test ./test`), and record that the tree needed a workaround.
- If you must strip the tail to proceed, say so in the evidence: the tree is then **modified**, and the run no longer certifies the raw commit.

---

## 7. Phase F — harden credentials on a new branch

Only start this after Phases C–E produced evidence.

```bash
cd ../rsc-web-picture-market.worktrees/verify-89bc61f
git switch -c chore/harden-baseline-89bc61f
```

**Untrack the environment file, keep it on disk:**

```bash
git rm --cached .env
ls -l .env            # must still exist
```

**Fix the broken ignore rule.** Replace the single line `.env .env.local .env.production` with three separate lines:

```text
.env
.env.local
.env.production
```

**Remove the hardcoded password from compose.** In `_01_rsc_wpm_backend/docker-compose.yml`:

```yaml
POSTGRES_USER: ${POSTGRES_USER:?POSTGRES_USER must be set}
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set}
POSTGRES_DB: wpm_db
```

**Generate the new value and write it to the untracked `.env`** (also update `DB_USER` / `DB_PASSWORD` there so the backend agrees):

```bash
openssl rand -base64 32 | tr -d '\n'
```

**Recreate the volume so `initdb` bakes the new password in, then re-verify:**

```bash
cd _01_rsc_wpm_backend
docker compose -p verify-base-89bc61f --env-file ../.env down -v
docker compose -p verify-base-89bc61f --env-file ../.env up -d --build
curl -s http://localhost:4001/health
cd .. && bun run --cwd _01_rsc_wpm_backend test:all
```

`down -v` is destructive — it drops the baseline volume and every row written by Phases D–E. That is expected here.

---

## 8. Phase G — commit and tag

```bash
cd ../rsc-web-picture-market.worktrees/verify-89bc61f
git status --short
git add .gitignore _01_rsc_wpm_backend/docker-compose.yml
git commit -m 'chore(security): remove hardcoded credentials from the baseline compose file'
```

Commit rules for this repository: Conventional Commits, lowercase scope, **no Co-Authored-By or AI attribution**.

**Tag — the name must not lie.**

| Do not use | Because |
|---|---|
| `baseline/...` | already means the root commit `109ddc6` |
| `R-...-verified-...` | already means "recorded green at 9736339" |

```bash
git tag -a hardened/89bc61f-secretless -F - <<'EOF'
Hardened variant of the 89bc61f baseline. NOT the verified baseline.

Parent commit: 89bc61f (2026-10-02)
Changes: .env untracked, .gitignore fixed, compose password read from
POSTGRES_PASSWORD instead of the admin123 literal.

Verification of the hardened tree:
- docker compose -p verify-base-89bc61f --env-file ../.env, fresh volume
- curl /health -> {"status":"ok"}
- bun run test:all -> <fill in observed counts>

The published history still contains the old literal. Only rotation retires it.
EOF
```

Pushing is a separate decision:

```bash
git push -u origin chore/harden-baseline-89bc61f
git push origin hardened/89bc61f-secretless
```

---

## 9. Phase H — restore your environment

```bash
# stop and remove the baseline stack (keep the volume if you want its data)
docker compose -p verify-base-89bc61f down

cd /home/mgl/AI-Agents-Tests/rsc-harness/rsc-web-picture-market
./project-tools/container-management.sh start-all
docker ps --format '{{.Names}}\t{{.Status}}' | grep -E 'rsc|wpm'
curl -s http://localhost:4001/health
```

---

## 10. Phase I — optional teardown

```bash
cd /home/mgl/AI-Agents-Tests/rsc-harness/rsc-web-picture-market
git worktree remove ../rsc-web-picture-market.worktrees/verify-89bc61f
```

Refused if the worktree is dirty — commit or discard first. Never run `git worktree prune` blindly: it would drop the `/tmp/opencode/wt-gov` registration another session may still reference.

---

## 11. Troubleshooting matrix

| Symptom | Cause | Fix |
|---|---|---|
| `role "postgres" does not exist` | superuser is `admin` | `psql -U admin -d wpm_db` |
| `database "admin" does not exist` | psql defaults DB to the role name | add `-d wpm_db` |
| `port is already allocated` | live stack still running | repeat Phase B |
| `Container name ... is already in use` | `container_name:` is global | stop `01_rsc_wpm_bun_psgres-backend` |
| `relation "usuario" does not exist` | init script never ran (volume not empty) | `down -v`, then `up` |
| `/health` returns 503 | DB credentials mismatch | align `.env` with the compose password |
| frontend suite connection refused | wrong `API_URL` | host run: `http://localhost:4001` |
| `bun run` JSON parse error | stray `package.json` tail | see Phase E |

---

## 12. Evidence template

```text
Date:                <yyyy-mm-dd hh:mm>
Worktree:            ../rsc-web-picture-market.worktrees/verify-89bc61f
Commit (full sha):   <git rev-parse HEAD>
Compose project:     verify-base-89bc61f
Volume:              verify-base-89bc61f_postgres_data
Tree modified?:      no / yes -> <what and why>

/health:             <200 ok | 503 | error>
psql \dt:             usuario present: <yes|no>
backend test:all:    <pass>/<fail>, assertions <n>
backend test:unit:   <pass>/<fail>
frontend suite:      <pass>/<fail>, assertions <n>

Deviations:          <anything that differed from this runbook>
Verdict:             <reproduced the recorded green | did not reproduce>
```

---

## 13. Stop conditions

Halt and report, do not improvise, when:

1. The resolved compose project or volume collides with the dev stack.
2. `/health` is not `{"status":"ok"}` after a fresh `up`.
3. Test counts differ from 16/0/36 and 11/28 without an explained cause.
4. You had to edit a tracked file before Phase F to make the suite run.
5. `git rev-parse HEAD` does not match the commit you intended to verify.

---

## Appendix A — Direct container commands (fallback)

Use these when `project-tools/container-management.sh` does not expose what you need, or when it fails. All `docker compose` forms below assume you are inside `../rsc-web-picture-market.worktrees/verify-89bc61f/_01_rsc_wpm_backend` (otherwise add `-f <path>/docker-compose.yml`).

**Naming at this commit:** the postgres service has no `container_name:`, so under project `verify-base-89bc61f` it becomes `verify-base-89bc61f-postgres-1`. The backend keeps its hardcoded `01_rsc_wpm_bun_psgres-backend`, which is why the dev stack must be stopped first.

### Inspect

```bash
docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -E 'rsc|verify-base'
docker compose -p verify-base-89bc61f ps -a
docker logs --tail 50 01_rsc_wpm_bun_psgres-backend
docker compose -p verify-base-89bc61f logs --tail 50 postgres backend
docker inspect -f '{{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{end}}' verify-base-89bc61f-postgres-1
docker port 01_rsc_wpm_bun_psgres-backend
docker stats --no-stream
```

### Start / stop / restart (non-destructive)

```bash
docker stop 01_rsc_wpm_bun_psgres-backend
docker start 01_rsc_wpm_bun_psgres-backend
docker restart 01_rsc_wpm_bun_psgres-backend

docker compose -p verify-base-89bc61f stop
docker compose -p verify-base-89bc61f start
docker compose -p verify-base-89bc61f restart backend
docker compose -p verify-base-89bc61f up -d --build
```

`docker kill` sends SIGKILL — last resort when a container ignores `stop`:

```bash
docker kill 01_rsc_wpm_bun_psgres-backend
```

### Remove containers (volume survives)

```bash
docker rm -f 01_rsc_wpm_bun_psgres-backend
docker compose -p verify-base-89bc61f down          # containers + network, volume kept
docker compose -p verify-base-89bc61f down -v       # DESTROYS the volume and its rows
```

### Database operations inside the container

```bash
# interactive session (local socket is trust, no password)
docker exec -it verify-base-89bc61f-postgres-1 psql -U admin -d wpm_db

# one-shot query
docker exec verify-base-89bc61f-postgres-1 psql -U admin -d wpm_db -c '\dt'

# logical backup without roles/passwords
docker exec verify-base-89bc61f-postgres-1 pg_dump -U admin -d wpm_db -Fc > /tmp/wpm_db.dump

# restore (destructive to the target objects)
docker exec -i verify-base-89bc61f-postgres-1 pg_restore -U admin -d wpm_db --no-owner --clean --if-exists < /tmp/wpm_db.dump

# pipe a plain SQL file in
docker exec -i verify-base-89bc61f-postgres-1 psql -U admin -d wpm_db < schema.sql
```

### Ports and conflicts

```bash
ss -ltnp | grep -E ':(4001|5432)\b'
docker ps --filter publish=4001
docker ps --filter name=01_rsc_wpm_bun_psgres-backend
```

### Volumes and networks

```bash
docker volume ls --format '{{.Name}}' | grep -E 'verify-base|rsc|wpm'
docker volume inspect verify-base-89bc61f_postgres_data
docker volume rm verify-base-89bc61f_postgres_data     # refused if still in use

docker network ls | grep -E 'rsc|verify-base'
docker network inspect verify-base-89bc61f_rsc-network
```

### What each command destroys

| Command | Containers | Volume + data | Reversible |
|---|---|---|---|
| `stop` / `start` / `restart` | kept | kept | yes |
| `up -d --build` | recreated | kept | yes |
| `docker rm -f <c>` | destroyed | kept | recreate with `up` |
| `compose down` | destroyed | kept | recreate with `up` |
| `compose down -v` | destroyed | **destroyed** | only `up` re-inits from scratch |
| `docker volume rm <v>` | untouched | **destroyed** | no |
| `pg_restore --clean` | untouched | objects dropped and reloaded | no, unless you dumped first |

**Never** run `docker volume rm` or `down -v` against `01_rsc_wpm_backend_postgres_data` — that is your dev database, not the baseline's.
