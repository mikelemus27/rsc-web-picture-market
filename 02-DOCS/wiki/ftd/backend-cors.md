# Backend CORS (deny-by-default allowlist; preflights exempt from the limiter)

- **Date**: 2026-10-14
- **Branch**: `feat/dev-backend-cors` (from `dev` @ `254a532`)
- **Tracks**: GitHub issue #54 → PR #55 (merged as `93db31c`); `TODO.md` → *Add CORS configuration*
  (item 30)
- **Lane**: FTD
- **Route**: delegated direct — one bounded writer for 3 non-trivial new files (`Cors.ts` + two
  suites), with the wiring, compose and docs edits in the same unit; parent verifies independently.

## Intent

The API sends no CORS headers at all, so a browser at any other origin cannot read its responses.
CORS is not a server-side gate: the *browser* enforces it, and it enforces it on **reads**. A
request can still reach the server and be processed — what fails is the browser handing the
response body to JavaScript. That distinction decides the scope below.

Nothing is broken today, and this is the honest framing: the repository has **no browser client**.
`_02_rsc_wp_frontend/package.json` has no `dependencies` besides types, there is no HTML/JSX/TSX/
Svelte/Vite anywhere in the project, and `README.md:69` states the commands do not render a browser
storefront. So this work is **forward-looking**: it makes the API ready for the first browser
client without changing anything a current consumer observes.

The shape was settled with the user **before** implementation:

- **deny by default** — with `CORS_ALLOWED_ORIGINS` unset the API sends no CORS headers, so the
  feature is inert until deliberately configured and today's behaviour is unchanged,
- an **allowlist** read from configuration, never a hardcoded origin and never a blanket `*`,
- **preflights are exempt from the rate limiter**, by construction rather than by special case,
- **configurable by environment variable** — read from `CORS_ALLOWED_ORIGINS`, set in the
  backend's own `.env` (the file Compose reads beside its compose file) or exported in the shell.
  The repo-root `.env` does **not** reach this service: `container-management.sh` exports only
  `PORT` from there.

## Scope

### In

- New `src/infraestructura/adaptadores/input/http/Cors.ts`:
  - `parseAllowedOrigins(raw)` → trimmed, non-empty, de-duplicated origins; `*` is accepted as an
    explicit opt-in to any origin.
  - `createCorsPolicy({ allowedOrigins })` → `{ allowedOrigins, isAllowed(origin),
    headersFor(origin), preflight(origin) }` — pure, no request/response coupling.
  - `withCors(handler, policy)` → returns a handler that answers an `OPTIONS` preflight itself and
    otherwise applies the policy's headers to **whatever** the wrapped handler returns.
- `src/index.ts`: build the policy from `CORS_ALLOWED_ORIGINS` next to `createRateLimiter`
  (`:99-102`), and change the single `Bun.serve` handler from an inline method to
  `fetch: withCors(async (req) => { … })` so **every** response — route payloads, `404`, `405`,
  the `429` from the limiter, the `500` catch, and `/health` — leaves through one place.
- `test/cors.test.ts`: hermetic unit tests for parsing, matching, header selection and the
  preflight response.
- `test/cors.api.test.ts`: HTTP test on an ephemeral `Bun.serve` (port `0`) proving the wiring —
  an allowed origin is echoed, a disallowed origin is not, a preflight succeeds, and a preflight
  is **not** counted by the limiter.
- `package.json`: a `test:cors` script mirroring `test:rate-limit` (`tsc --noEmit` + the hermetic
  suites).
- `docker-compose.yml`: `CORS_ALLOWED_ORIGINS` passed through as `${CORS_ALLOWED_ORIGINS:-}`,
  mirroring the `PORT` / `RATE_LIMIT_*` lines.
- `BackEnd_README.md`: the variable in the env table plus the deny-by-default note.
- `TODO.md`: the item moves to completed with evidence.

### Out

- **No `Access-Control-Allow-Credentials`**: there is no authentication yet, so there are no
  credentials to send. It is also the one header that cannot be combined with a `*` allowlist, so
  adding it speculatively would constrain the policy for no benefit.
- **No `Access-Control-Expose-Headers`**: nothing custom is returned that browser JS must read.
  Pagination metadata stays in the response body rather than a custom header, so this stays out of
  scope until the pagination contract is decided.
- **No per-route policy**: one global allowlist, not an endpoint-level matrix.
- **No cookie/session semantics**, no `SameSite` work — there is no auth to carry.
- Frontend untouched; nothing in `_02_rsc_wp_frontend` changes.

## Design decisions

1. **Deny by default.** An unset or unparseable `CORS_ALLOWED_ORIGINS` yields an empty allowlist, and
   an empty allowlist emits no `Access-Control-Allow-Origin`. A configuration mistake therefore
   degrades to "no cross-origin reads" instead of "every origin may read". This mirrors the
   fail-safe choice made for `RATE_LIMIT_MAX_REQUESTS` (bad value → the default, never "no limit"),
   but points the failure in the safe direction for this feature: the dangerous outcome here is
   over-permission, not under-permission.
2. **Preflights bypass the limiter by construction.** The limiter guard lives *inside* the router
   (`index.ts:157-163`) and only `/health` is exempt. Wrapping the handler means `withCors` sees the
   request first and answers `OPTIONS` before the router runs, so a preflight can never consume the
   client's budget or be answered `429`. A browser whose preflight is throttled cannot make the real
   request, so a limiter that ignored this would break the very clients CORS exists to serve. No
   special case is added to the limiter itself.
3. **Wrap the response, do not sprinkle headers.** All responses already funnel through one
   `Bun.serve` handler; wrapping it keeps that single exit point and guarantees an error path
   (`404`, `405`, `500`) cannot forget its headers. The alternative — setting headers at each of the
   ~16 `json(...)` call sites — duplicates the decision and drops it on whatever is added next.
4. **Echo the matched origin, not `*`.** When the allowlist matches, the response echoes the exact
   request `Origin`. `*` is sent only when the allowlist literally contains `*`, making it an
   explicit, reviewable opt-in rather than the silent default.
5. **`Vary: Origin` whenever the request carried an `Origin`.** The response body/headers depend on
   the request's origin, so a shared cache must key on it. It is sent even when the origin is
   refused, because the decision itself is origin-dependent.
6. **Configuration, not code, decides the allowlist.** Nothing is hardcoded; enabling a browser
   client is one line in the backend's own `.env`, or one exported variable in the shell. This keeps
   the policy auditable in one place. The repo-root `.env` is deliberately **not** where it belongs:
   Compose reads the `.env` beside the compose file, and `container-management.sh` exports only
   `PORT` from the root, so a variable placed there would never reach the container.

## Checklist

- [x] 1. RED first: both new suites failed with
      `Cannot find module '../src/infraestructura/adaptadores/input/http/Cors'` — `0 pass / 2 fail`,
      exit 1. Observed by the implementing worker before any implementation existed; the parent did
      **not** re-observe this one. It is structurally sound rather than merely asserted: `Cors.ts` is
      new on this branch (it shows as untracked in `git status`), so a missing-module failure was the
      only possible outcome before the module was written.
- [x] 2. GREEN: `bun run test:cors` → **34 pass / 0 fail**, 76 `expect()` calls across 5 files; the
      two new suites alone are 23 pass / 0 fail / 56 expects.
- [x] 3. `bunx tsc --noEmit` → exit 0, no output.
- [x] 4. Compose pass-through: `docker compose config` → `CORS_ALLOWED_ORIGINS: ""` when unset, and
      `http://localhost:3000,http://localhost:5173` when set.
- [x] 5. Regression: `test/health.test.ts`, `test/create-usuario-handler.test.ts` and
      `test/server-port.test.ts` all pass in the same run.
- [x] 6. Deny-by-default proven live against the rebuilt stack (below), not only hermetically.
- [x] 7. `BackEnd_README.md` documents the variable; `TODO.md` item closed with evidence.

## Evidence

Every row was re-run by the parent after the worker returned. Nothing below is taken on the
worker's word. Observed on branch `feat/dev-backend-cors`; the 2026-10-16 rows are re-runs after
the merge, on `dev` @ `93db31c`. `bun` commands run in `_01_rsc_wpm_backend`;
`container-management.sh` runs from the repository root.

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `bunx tsc --noEmit` | exit 0, no output |
| Full feature suite | `bun run test:cors` | 34 pass / 0 fail, 76 expects, 5 files, exit 0 |
| New suites only | `bun test test/cors.test.ts test/cors.api.test.ts` | 23 pass / 0 fail, 56 expects, exit 0 |
| Canonical gate | `project-tools/container-management.sh test-backend` | 58 pass / 0 fail, 233 expects, 8 files, exit 0 |
| Canonical gate (container) | `project-tools/container-management.sh test-backend --container` | 13 pass / 0 fail, exit 0 |
| Compose interpolation | `docker compose config` | `""` unset; both origins when set |
| RED (worker-observed) | `bun test test/cors.test.ts test/cors.api.test.ts` | `Cannot find module …/Cors`; 0 pass / 2 fail |
| Green re-run on merged `dev` | `project-tools/container-management.sh test-backend` | 58 pass / 0 fail, 233 expects, 8 files, exit 0 |
| Typecheck re-run on merged `dev` | `bunx tsc --noEmit` | exit 0 |

### Live proof on the rebuilt stack

The hermetic suite re-implements the wiring, so on its own it cannot prove that `index.ts` is
wired correctly. The backend image bakes `src/`, so the stack was rebuilt and driven with `curl`.
`/health` is the probe because the limiter exempts it — leaving the headers as the only variable:

- **Deny by default** — rebuilt with the variable unset, `GET /health` with
  `Origin: http://localhost:3000` returned `200` with **no** `Access-Control-Allow-Origin`, only
  `Vary: Origin`.
- **Allowed origin** — recreated with `CORS_ALLOWED_ORIGINS=http://localhost:3000`, the same request
  returned `Access-Control-Allow-Origin: http://localhost:3000` alongside `Vary: Origin`.
- **Refused origin** — with the variable still set, `Origin: http://evil.test` returned **no**
  `Access-Control-Allow-Origin`, only `Vary: Origin`.
- **Preflight** — `OPTIONS /usuarios` with an allowed origin returned `204` carrying
  `Access-Control-Allow-Origin`, `Vary: Origin`,
  `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`,
  `Access-Control-Allow-Headers: Content-Type` and `Access-Control-Max-Age: 600`.
- **Restored** — recreated once more without the variable and again returned no
  `Access-Control-Allow-Origin`, so the stack is left in its original deny-by-default state.

Two honest limits on this evidence:

- **`curl` cannot prove browser enforcement.** CORS is enforced by the *browser*. The live checks
  prove the server emits exactly the headers the policy dictates, which is the server's entire
  responsibility here; nothing above demonstrates an actual cross-origin read succeeding, and no
  browser client exists in this repository to demonstrate it with.
- **Four consecutive preflights all returned `204`, but that alone proves nothing about the
  limiter** — four requests cannot exhaust a 100/minute budget. The real proof of the bypass is the
  hermetic test with `max: 1`: a preflight leaves the single slot unspent, so the next `GET` is
  `200` and the `GET` after that is `429`. Without the short-circuit the *first* `GET` would already
  be `429`.

### Where the variable actually comes from (verified)

An earlier draft of this record — and the two compose comments — claimed the value is interpolated
from the root `./.env`. That is **wrong**, and it was corrected here after a direct Compose test. A
throwaway Compose project placed beside this repository proved the resolution order:

| Where `CORS_ALLOWED_ORIGINS` is set | Reaches the container? |
| --- | --- |
| `_01_rsc_wpm_backend/.env` (beside the compose file) | **yes** — this is the file Compose reads |
| exported in the shell before `docker compose up` | **yes**, and it overrides the file |
| the repo-root `./.env` | **no** — a `.env` in the current directory is never read for this project |

`container-management.sh` exports only `PORT` from the root `.env`, so `PORT` is the single variable
that genuinely travels that path. The `RATE_LIMIT_*` pair never did either, despite the comment it
carried; that comment is corrected in the same change.

## Next step

Shipped and closed: PR #55 merged into `dev` (`93db31c`), issue #54 closed as completed, and this
record closes the CORS backlog entry (`TODO.md` item 30). Nothing further is pending for this
feature. The natural follow-ups, none of them committed to yet: an actual browser client to
demonstrate cross-origin enforcement end to end — nothing in this repository has one today, so the
live checks above prove the headers the server emits rather than a real cross-origin read — and
`Access-Control-Allow-Credentials` if the API ever grows authentication worth sending. The Compose
environment-resolution question this work surfaced is tracked separately as `TODO.md` item 37 and
is deliberately not settled here.
