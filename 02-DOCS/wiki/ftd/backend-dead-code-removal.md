# Remove dead backend files (`main.ts`, `indexOld.ts`, `test_debug.ts`)

- **Date**: 2026-10-08
- **Branch**: `chore/dev-remove-backend-dead-code` (from `dev` @ `e969486`)
- **Closes**: `TODO.md` → *Delete dead backend file `src/main.ts`* and *Clean up dead backend files*
- **Lane**: FTD (one doc, then tasks against observed proof)

## Intent

Three files in the backend are not part of the running system yet sit alongside the real
entrypoint, which makes the source tree lie about what executes:

| File | Lines | What it is | Why it is dead |
| --- | --- | --- | --- |
| `src/main.ts` | 376 | Duplicate bootstrap + inline `Bun.serve` | Not an entrypoint anywhere; its `UsuarioController` wiring is outdated and produces **2 `tsc` errors** (TS2554 at 29:3 and 258:17) |
| `src/indexOld.ts` | 417 | Legacy monolithic implementation | No importer; carries its own hardcoded connection block |
| `test_debug.ts` | 611 | Manual `fetch`-and-print script | Superseded by `test/usuarios.backend.api.test.ts` (real assertions, runs in `test:all`) |

The goal is a backend where `tsc --noEmit` reports **zero** errors and every file in `src/` is
reachable from the entrypoint `src/index.ts`.

## Evidence that they are dead (collected before the change)

- **Entrypoints**: `package.json` → `"module": "index.ts"`; `Dockerfile` → `CMD ["bun","run","./dist/index.js"]`
  (built from `index.ts`); `Dockerfile_bas` → `CMD ["bun","src/index.ts"]`. None names `main.ts`.
- **No importers**: `src/main.ts` has zero `export` statements, so nothing can import it. No file
  references `indexOld.ts` or `test_debug.ts`.
- **No config references**: `grep` over `package.json`, `tsconfig.json`, `docker-compose.yml`,
  `Dockerfile`, `Dockerfile_bas`, `run-backend-tests.ts` → no hits.
- **Typecheck baseline**: `bunx tsc --noEmit` → exactly 2 errors, both in `src/main.ts`.
- **Live-doc references**: only `BackEnd_README.md` (lines 137, 142, 143, 450, 478).

## Scope

### In
- `git rm src/main.ts src/indexOld.ts test_debug.ts`.
- Update the live documentation that promises these files: `BackEnd_README.md`
  (directory tree entries at 137/142/143; the "legacy standalone script" sentence at 450; the
  `bun test_debug.ts` block at 475-479).
- Update `TODO.md`: move both items to `## Completed` with evidence, and fix the now-stale
  `src/main.ts` parenthetical in the *Use `process.env.PORT`* item — leaving a reference to a
  deleted file would contradict the done-check *"nothing references them"*.

### Out
- **`commands.md`** (the third part of the *Clean up dead backend files* item, worded as
  *"evaluate `commands.md` (purpose unclear)"*) — evaluated, **kept**, verdict below.
- **`process.env.PORT`** itself (separate `TODO.md` item) — only its stale parenthetical is touched.
- **`eAUser.ts`** (already deleted, still listed in `BackEnd_README.md:146`) — observed drift, reported,
  not fixed here.
- **Historical references** — see decision 3.
- No behaviour change: no runtime file is touched, so no API contract moves.

## Decisions

1. **Delete rather than fix `main.ts`.** It is not an entrypoint and duplicates `index.ts`; keeping a
   second bootstrap means every future change to the composition root has two places to drift.
2. **`indexOld.ts` is the one with a security angle.** It contains a self-contained connection block
   (`host: "postgres"`, `user: "admin"`, `database: "escuela"`, `password: "REMOVED"`) that bypasses the
   `secrets/` file mounts introduced in PR #23. The value is already redacted in-tree, but a
   credential-shaped "alternative implementation" invites someone to re-populate it. Removal closes that.
3. **Historical records stay untouched** — `.github/issue_refactor_tdd.md`, `LEARNINGS/*.md`,
   `02-DOCS/**` FTD docs. They describe past states; rewriting them would falsify the record. The
   done-check *"nothing references them"* is applied to **live** artifacts (source, config, READMEs,
   the open backlog). Note that `issue_refactor_tdd.md` asked for `test_debug.ts` to be converted to
   structured `expect()` assertions — that intent is already satisfied by
   `test/usuarios.backend.api.test.ts` + `run-backend-tests.ts`, so deleting the script fulfils the
   issue rather than contradicting it. `gh issue list` reports no open GitHub issue to close.
4. **`commands.md` verdict: keep.** It is 158 lines of Spanish operational scratch notes (compose
   commands, container IP inspection, SQL, cURL) that duplicate the README in parts and are stale in
   others (`sudo docker …`, `docker inspect` for the DB IP, a database named `escuela` that no longer
   exists). It is not dead — it is **unmaintained**, which is a different item: consolidating or
   deleting it is a documentation decision, not a dead-code removal, and doing it here would mix two
   concerns in one review. Reported as a follow-up instead.
5. **Verification must include a container build.** The backend image bakes `src/` into the build, so a
   successful `rebuild-all` plus a live `GET /health` proves nothing at runtime depended on the deleted
   files — stronger than a typecheck alone.

## Checklist

- [x] 1. Delete the three files; confirm the tree no longer lists them.
- [x] 2. Update `BackEnd_README.md` (tree + the two `test_debug.ts` promises).
- [x] 3. `grep` the repo for live references → only historical records may remain.
- [x] 4. `bunx tsc --noEmit` in the backend → **0 errors** (baseline: 2).
- [x] 5. `bun run test:all` → 21 pass, 0 fail (unchanged).
- [x] 6. `rebuild-all` → exit 0; live `GET /health` → 200; `container-management` harness 13/13.
- [x] 7. `db-healthcheck.sh` → 8/8; frontend suite → 11/11.
- [x] 8. `TODO.md` updated (both items → Completed, stale parenthetical fixed).

## Evidence

Observed after the change, on branch `chore/dev-remove-backend-dead-code`:

| Check | Command | Result |
| --- | --- | --- |
| Files gone | `git rm src/main.ts src/indexOld.ts test_debug.ts` | `D` ×3; `git status` shows no residue |
| Typecheck | `bunx tsc --noEmit` | **exit 0, no output** — zero errors (baseline: 2× TS2554 in `src/main.ts`) |
| Unit + API | `bun run test:all` | 21 pass, 0 fail, 47 expect() calls |
| Live references | `grep -rn 'main\.ts\|indexOld\|test_debug'` over backend, `project-tools`, `.github/workflows`, root READMEs | only the two `TODO.md` items (now Completed) + vendor docs under `node_modules/` |
| Container build | `sh project-tools/container-management.sh rebuild-all` | **exit 0** — backend built and started; frontend reported `exited 0 (its CMD is the frontend test suite)` |
| Deployed image | `ls /app` / `grep -c conectarDB /app/dist/index.js` | `dist`, `node_modules`; `conectarDB` (an `indexOld.ts` symbol) → **0** |
| Live server | `curl http://localhost:4001/health` | `200` `{ "status": "ok" }` |
| Shell harness | `tests/container-management.test.sh` | All 13 assertions passed |
| Database | `bash project-tools/db-healthcheck.sh` | 8/8 checks passed |
| Frontend | `container-management.sh test-frontend` | 11 pass, 0 fail, exit 0 |

Full battery after removal: **53 green checks** (backend 21 + frontend 11 + harness 13 + db-healthcheck 8), the same total as before the change, with the typecheck improving from 2 errors to 0.

## Observed, not changed

- `BackEnd_README.md:146` still lists `src/dominio/eAUser.ts`, which no longer exists (removed in an earlier change). Same class of drift, different item — reported as a follow-up rather than folded into this review.
- `src/index.ts` still hardcodes `port: 4001`; the separate `process.env.PORT` item remains open (only its stale `main.ts` mention was corrected).

## Next step

Commit `chore(backend): remove dead main.ts, indexOld.ts and test_debug.ts`, push, and open a PR
against `dev` for the user to merge.
