# Backend rate limiting (100 req/min/IP, 429 on excess)

- **Date**: 2026-10-12
- **Branch**: `feat/dev-backend-rate-limiting` (from `dev` @ `7a979db`)
- **Tracks**: GitHub issue #52 → PR #53 (merged as `171d55b`); `TODO.md` → *Add rate limiting*
- **Lane**: FTD — a retrospective record: the feature shipped, and this doc is the follow-up the
  backlog asked for (written 2026-10-13)

## Intent

The `/usuarios` API in `_01_rsc_wpm_backend` had no request throttling at all: any client could
hammer every route as fast as it could open sockets. The backlog asked for an in-memory limiter
of about 100 requests per minute per client IP, answering `429` when a client goes over.

The shape was settled with the user **before** implementation, because the honest answer depends
on deployment reality, not on the algorithm alone:

- a **pure fixed-window** counter (no sliding log, no token bucket, no external store),
- keyed by the **real socket peer IP**, deliberately **not** by `X-Forwarded-For` (spoofable),
- **`/health` exempt**, so the Compose healthcheck can never rate-limit the service into a
  restart loop,
- **configurable like `PORT`** — defaults baked in, override through the root `./.env` and the
  backend `docker-compose.yml`, same convention the port already follows.

## Scope

### In
- New `src/infraestructura/adaptadores/input/http/RateLimiter.ts`:
  - `createRateLimiter({ max?, windowMs?, now?, maxKeys? })` → `{ check(key), size() }`, the clock
    injectable for hermetic tests; defaults `max: 100`, `windowMs: 60_000`, `maxKeys: 4096`.
  - `tooManyRequestsResponse(retryAfterMs)` → `429` with `Retry-After: max(1, ceil(ms/1000))`
    (seconds) and body `{ error: "Too Many Requests", retryAfterMs }`.
- `src/index.ts`: the limiter is created at module load from `readPositiveIntEnv(...)`
  (`:95-102`); the guard sits **inside the single `Bun.serve` router, before any route handling**
  (`:157-163`), keyed `server.requestIP(req)?.address ?? "unknown"`, and skipped when
  `pathname === "/health"`.
- `test/rate-limiter.test.ts`: 10 hermetic unit tests (fake clock) — under the limit allowed, at
  the limit blocked with the right `retryAfterMs`, window expiry resets, keys are independent,
  invalid `max`/`windowMs` fall back to defaults, the sweep bound holds, response shape.
- `test/rate-limit.api.test.ts`: 1 HTTP test — an ephemeral `Bun.serve` on port `0` with `max: 2`
  answers `200`, `200`, then `429` with the header and body.
- `docker-compose.yml`: `RATE_LIMIT_MAX_REQUESTS` and `RATE_LIMIT_WINDOW_MS` passed through as
  `${VAR:-default}`, mirroring the existing `PORT: ${PORT:-4001}` line.
- `BackEnd_README.md`: both vars documented in the env table plus the `429` + `/health` note.
- `TODO.md`: the item moves to completed with evidence.

### Out
- **No shared store** (Redis, memcached, …): the limiter is per-process memory only. A restart
  resets every counter, and two backend instances would each enforce their own budget.
- **No `X-Forwarded-For` parsing**: the header is client-controlled and therefore spoofable —
  trusting it would let anyone forge a fresh identity per request. Real client IP recovery behind
  a reverse proxy is a separate concern with its own decision to make.
- **No per-route limits**: one bucket per key, not per endpoint — a single global budget.
- **No background eviction timer**: expired buckets are dropped opportunistically, and only once
  the map reaches `maxKeys` (see design decisions).
- Frontend untouched; nothing in `_02_rsc_wp_frontend` changes.

## Design decisions

1. **Fixed window over sliding/token bucket.** ~30 lines, deterministic, no timers, trivial to
   test with a fake clock. The accepted tradeoff: a client can burst up to 2× the limit across a
   window boundary (the tail of one window plus the head of the next). The backlog asked for a
   simple limiter, not a traffic shaper.
2. **Money on `server.requestIP(req)`.** Bun exposes the socket peer, which is what the process
   can actually observe. Missing address → the literal `"unknown"` key, so a client we cannot
   identify is still limited instead of escaping the budget.
3. **`/health` exempt on purpose.** The Compose healthcheck polls that route; if the healthcheck
   itself were rate-limited the container would be marked unhealthy and restarted — a limiter
   turning into an outage. Exemption is a correctness requirement, not a convenience.
4. **Fail safe on bad configuration.** `readPositiveIntEnv` (`index.ts:95-96`) returns the
   fallback for anything that is not a positive integer, so a typo in `RATE_LIMIT_MAX_REQUESTS`
   degrades to the default **100** rather than to "no limit".
5. **Bounded memory without a timer.** The buckets map is capped by `maxKeys` (4096); when it
   reaches that bound, `sweepExpired` drops every entry whose window has elapsed. A busy process
   stays bounded, an idle one just holds a handful of buckets.
6. **Documented caveats** (also in `BackEnd_README.md`): in-memory ⇒ the counter resets on
   restart; behind the Compose network all clients share the gateway IP, so the effective limit is
   shared until the per-IP mapping is fixed upstream; `Retry-After` is rounded **up** to whole
   seconds, so the client never retries early.

## Checklist

- [x] 1. RED first: both new suites fail with `Cannot find module …/RateLimiter` — no
      implementation exists yet.
- [x] 2. GREEN: limiter + router wiring → `bun run test:rate-limit` → 22 pass / 0 fail.
- [x] 3. `bunx tsc --noEmit` → exit 0, no output.
- [x] 4. Compose pass-through verified via `docker compose config`.
- [x] 5. Live proof on the rebuilt stack (image bakes `src/`): 101 sequential `GET /usuarios` →
      **100×200 + 1×429**.
- [x] 6. Regression: `bun run test:all` → 35 pass / 0 fail (6 files); `/health` 200 throughout.
- [x] 7. `BackEnd_README.md` documents both vars + the `429` behavior; `TODO.md` item closed.

## Evidence

Observed on branch `feat/dev-backend-rate-limiting`; the two 2026-10-13 rows are re-runs after
the merge, on `dev` @ `171d55b`.

| Check | Command | Result |
| --- | --- | --- |
| Red | `bun test test/rate-limiter.test.ts test/rate-limit.api.test.ts` (before the code) | fail — `Cannot find module …/RateLimiter`, both suites |
| Green (hermetic) | `bun run test:rate-limit` | **22 pass, 0 fail** |
| Green re-run on merged `dev` | `bun run test:rate-limit` | **22 pass, 0 fail, 143 expect() calls across 5 files** |
| Typecheck | `bunx tsc --noEmit` | exit 0, no output |
| Typecheck re-run on merged `dev` | `bunx tsc --noEmit` | exit 0 |
| Compose interpolation | `docker compose -f _01_rsc_wpm_backend/docker-compose.yml config` | `RATE_LIMIT_MAX_REQUESTS: "100"`, `RATE_LIMIT_WINDOW_MS: "60000"` |
| Live limit | 101 × `curl GET /usuarios` | 100×`200`, then 1×`429`; header `Retry-After: 58`; body `retryAfterMs: 57455` |
| Health exemption | `curl /health` during the burst | `200` throughout |
| Full suite (after the window reset) | `bun run test:all` | **35 pass, 0 fail** (6 files) |
| Regression suites (hermetic set) | included in `test:rate-limit` | `health` + `create-usuario-handler` + `server-port` green (`server exited with code 143` is that test's own SIGTERM cleanup — see `LEARNINGS/bun-testing-learnings.md`) |

## Next step

Shipped and closed: PR #53 merged into `dev` (`171d55b`), issue #52 closed as completed, and this
record closes the last follow-up item from the rate-limiting backlog entry. Nothing further is
pending for this feature. The natural follow-ups, none of them committed to yet: a shared store if
the backend ever scales past one process, and real client-IP recovery if it is ever placed behind
a trusted proxy.
