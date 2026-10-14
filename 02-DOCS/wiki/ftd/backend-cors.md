# Backend CORS (deny-by-default allowlist; preflights exempt from the limiter)

- **Date**: 2026-10-14
- **Branch**: `feat/dev-backend-cors` (from `dev` @ `254a532`)
- **Tracks**: `TODO.md` → *Add CORS configuration* (item 30)
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
- **configurable like `PORT`** — interpolated from the root `./.env` through the backend
  `docker-compose.yml`, the convention the port and the limiter already follow.

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
   client is one line in the root `./.env`. This keeps the policy auditable in one place and
   consistent with `PORT` and the limiter's environment contract.

## Checklist

- [ ] 1. RED first: both new suites fail — no `Cors` module exists yet.
- [ ] 2. GREEN: policy + wrapper + `index.ts` wiring → `bun run test:cors` passes.
- [ ] 3. `bunx tsc --noEmit` → exit 0, no output.
- [ ] 4. Compose pass-through verified via `docker compose config`.
- [ ] 5. Regression: the existing hermetic suites still pass; `/health` unaffected.
- [ ] 6. No CORS headers on a disallowed origin and none when the variable is unset (the deny-by-default proof).
- [ ] 7. `BackEnd_README.md` documents the variable; `TODO.md` item closed with evidence.

## Evidence

Filled in as each check is observed. No row is added before it is run.

| Check | Command | Result |
| --- | --- | --- |
| — | — | pending |

## Next step

Implement RED → GREEN, wire the compose pass-through, then close the `TODO.md` item with the
observed evidence. Issue/PR and any push remain the user's decision under ordinary repository
policy.
