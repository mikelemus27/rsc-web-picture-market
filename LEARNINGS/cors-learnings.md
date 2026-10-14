# CORS learnings

Project: `rsc-web-picture-market` — a Bun + PostgreSQL backend behind a single `Bun.serve` router,
consumed today by a Bun **CLI** test client, not a browser.

Use this as a decision reference before adding CORS anywhere: it explains what CORS actually
enforces, what a browser origin is, when the problem is real and when it is imaginary, and the four
concrete traps in this repository. The HTTP semantics are general; the file:line evidence is this
repository's state on 2026-10-13. Re-verify before trusting a line number.

## 1. CORS is enforced by the browser, not by your server

This is the misconception that makes everything else confusing.

Your server only **sends a few response headers**. The browser **reads them and decides** whether to
hand the response body to JavaScript. Nothing else participates — there is no server-side block, no
request rejection, no firewall.

Consequences that follow immediately:

- `bun run users:list` in `_02_rsc_wp_frontend/` is **not** affected by CORS. Neither is `curl`,
  Postman, or one container calling another. They are not browsers, so no policy applies.
- Adding CORS headers does **not** secure an API. An attacker running a script is not a browser, so
  CORS never enters their picture.
- Removing CORS headers does **not** stop anyone either. It only stops a browser from *reading*.

CORS is a browser-side rule protecting a **user** from a website. It is not a server-side rule
protecting an API from a client.

## 2. "Origin" is scheme + host + port — all three

Two URLs share an origin only when all three match.

| A | B | Same origin? | Why |
| --- | --- | --- | --- |
| `http://localhost:3000` | `http://localhost:4001` | **No** | port differs |
| `http://api.example.com` | `https://api.example.com` | **No** | scheme differs |
| `http://a.example.com` | `http://b.example.com` | **No** | host differs |
| `https://example.com` | `https://example.com/api` | Yes | path is irrelevant |

Changing the port is enough to make two services on your own machine cross-origin to each other —
which is exactly the situation a browser UI on `:3000` talking to an API on `:4001` creates.

## 3. Why the rule exists: the Same-Origin Policy

Without it, any page you visit could use your browser as a confused deputy.

You are logged into your bank. You open `evil.com`. Its script runs
`fetch("https://mybank.com/api/accounts")`. The browser would attach your bank session cookies —
the request is *legitimately authenticated* — and the response comes back fine. Evil JS now reads
your data.

The Same-Origin Policy blocks that read. CORS is the **controlled, opt-in relaxation**: the target
server can declare "yes, I intended `https://myapp.com` to read my responses."

Note what the attack needed: **ambient authority** (cookies the browser attaches automatically).
That is why the whole mechanism is about *reading*, and why a server with no cookie-based session
has far less to worry about.

## 4. Simple vs preflighted requests — and why this matters

CORS has two paths, and they differ in whether the request **executes**.

**Path 1 — "simple" request.** Method is `GET`, `HEAD` or `POST`, and every header is
safelisted (`Accept`, `Accept-Language`, `Content-Language`, `Content-Type` limited to
`application/x-www-form-urlencoded` / `multipart/form-data` / `text/plain`, plus `Range`):

1. The browser **sends the request**.
2. The server **executes it** — side effects happen, writes land.
3. The browser checks `Access-Control-Allow-Origin`. If it is missing or does not match, the browser
   **withholds the response body** from JS.

Read step 2 twice. **The request ran. Only the reading was blocked.**

**Path 2 — preflighted request.** `PUT`, `DELETE`, or `POST` with `Content-Type: application/json`
(not a safelisted value), or any non-safelisted header:

1. The browser first sends `OPTIONS` carrying `Access-Control-Request-Method` and
   `Access-Control-Request-Headers`.
2. The server must answer with `Access-Control-Allow-Origin` / `-Methods` / `-Headers`
   (optionally `-Max-Age`, which browsers cap at their own discretion — do not rely on a large value).
3. **Only if that passes** is the real request sent.

So preflighting prevents the *action*; a simple request permits the action and blocks only the read.

**This is why CSRF is a separate problem.** CORS was never designed to stop a cross-site request
from *doing* something. If an API must not accept cross-site writes, that is CSRF protection —
`SameSite` cookies, anti-CSRF tokens — not CORS. Never treat a CORS policy as a write barrier.

## 5. What CORS resolves — and what it does not

| Resolves | Does **not** resolve |
| --- | --- |
| A browser app on origin X calling an API on origin Y | Authentication — no header makes an open endpoint private |
| Letting browser JS read a response it was otherwise denied | Scripting/CLI abuse — non-browser clients ignore it entirely |
| Bringing an API's *response* into the app's origin | Flooding/DoS — that is the rate limiter |
| Declaring which methods and headers a browser may send | Server-to-server calls — never subject to it |
| Exposing specific response headers to browser JS (`Expose-Headers`) | Hiding an endpoint from anyone who can reach it |

One more precision worth keeping: **a top-level navigation is not cross-origin**. Opening
`http://localhost:4001/usuarios` in the address bar works fine with zero CORS configuration — the
browser navigates *to* that origin. CORS constrains `fetch`/`XMLHttpRequest` **from a different
origin**. "It blocks browser requests" is therefore too broad a statement: it blocks cross-origin
*reads by script*.

## 6. When CORS is actually needed

Ask one question: **is the caller a browser running on a different origin?**

| Caller | Needs CORS? |
| --- | --- |
| `curl`, Postman, a CLI | No — not a browser |
| A container calling another container (`http://backend:4001`) | No — server-to-server |
| A test suite using `fetch` under Bun/Node | No — not a browser |
| Browser JS on a different origin | **Yes** |
| Browser JS on the *same* origin | No — existing at all is enough |

**The cheap escape hatch:** if the UI is served by the *same* server as the API, the origin matches
and no CORS is needed at all. In this project that is a realistic option — `_02_rsc_wp_frontend/CLAUDE.md:36`
already points at Bun's HTML imports with `Bun.serve()`, which can serve a page from the very same
Bun server that answers `/usuarios`. Same origin, no policy, nothing to configure.

## 7. This repository: nothing is blocked today

Verified, not assumed:

| Evidence | Finding |
| --- | --- |
| `_02_rsc_wp_frontend/package.json` | `dependencies: None`; devDependencies only `{"@types/bun"}` — no React/Vue/Svelte/Vite/Next anywhere in the repo |
| `_02_rsc_wp_frontend/src/` | `listUsers.ts`, `createUser.ts`, `HttpClient.ts`, `apiConfig.ts`, `TestRunner.ts` — a CLI test client |
| `README.md:69` | the commands "test API contracts; they do not render or launch a browser-based storefront" |
| `_02_rsc_wp_frontend/FrontEnd_README.md:45-48` | documents the **future** step: "When evolving to an actual Vue/React app… the container must become a live server… expose the app port" |
| `_01_rsc_wpm_backend/src/` | no `access-control` / `cors` string at all |
| `TODO.md:30` | "No CORS headers; blocks browser requests." — the item is **forward-looking** |

So the open CORS item describes a *future* failure, not a current one. The CLI talks to the API
server-to-server and is immune by construction; the frontend suite passing is the proof that nothing
is blocked. CORS becomes load-bearing on the day a browser UI exists on another origin — and not one
day sooner.

## 8. Implementation checklist and the four traps in this codebase

The item's own done-criterion is "cross-origin requests from **allowed origins** succeed" — an
**allowlist**, not `*`.

- [ ] Read the allowed origins from configuration (env var, passed through Compose like `PORT`).
- [ ] Echo the matched origin into `Access-Control-Allow-Origin` — do **not** blanket `*` if any
      future auth will use credentials.
- [ ] Send **`Vary: Origin`** whenever the allow-origin value varies by request.
- [ ] Answer `OPTIONS` preflights with `-Methods` and `-Headers`.
- [ ] Add `Access-Control-Allow-Credentials: true` **only** if cookies/credentials are used, and then
      never pair it with `*` — that combination is forbidden by the spec.
- [ ] Add `Access-Control-Expose-Headers` if browser JS must read a custom response header.
- [ ] Test with an actual preflight, not just a GET.

**Trap 1 — the rate limiter will throttle preflights.** The limiter is wired in
`_01_rsc_wpm_backend/src/index.ts` **before any route handling**, with only `/health` exempt (see
`TODO.md:31`). Browser `OPTIONS` preflights would consume limiter quota, and a `429` on a *preflight*
does not degrade an app — it breaks it. Exempt `OPTIONS` the way `/health` was exempted, or the first
burst of activity takes the UI down.

**Trap 2 — echoing the origin needs `Vary: Origin`.** If the allow-origin value is reflected per
request and anything caches the response — a proxy, a CDN, the browser — one origin's approval can be
served to another. This is a correctness bug, not a style preference.

**Trap 3 — `*` and credentials are mutually exclusive.** Today `*` would expose nothing new, because
`TODO.md:29` confirms all endpoints are open. The moment cookie/JWT auth lands, `*` becomes wrong, and
the allowlist must already exist. Designing the allowlist now costs nothing; retrofitting it later
touches every response path.

**Trap 4 — headers are not readable by default.** Browser JS can read only the CORS-safelisted
response headers (`Cache-Control`, `Content-Language`, `Content-Length`, `Content-Type`, `Expires`,
`Last-Modified`, `Pragma`). Anything custom — `X-Total-Count`, for example — is invisible unless
`Access-Control-Expose-Headers` names it. This is the concrete dependency recorded in
[`pagination-learnings.md`](./pagination-learnings.md) §4: an envelope carries metadata in the body and
needs nothing from CORS, while header-based pagination metadata cannot be read from a browser until
CORS lands *and* remembers to expose it.

## 9. Verifying it without a browser

`curl` cannot test CORS **enforcement** — it has no policy and will happily read any response. What
you verify with `curl` is that the right **headers** come back; the browser does the enforcing.

```bash
# A preflight, exactly as a browser would send it
curl -i -X OPTIONS http://localhost:4001/usuarios \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type"

# A plain cross-origin request: check for Access-Control-Allow-Origin + Vary: Origin
curl -i http://localhost:4001/usuarios -H "Origin: http://localhost:3000"
```

Expect `204`/`200` for the preflight with the `Access-Control-*` headers present, and
`Access-Control-Allow-Origin` reflecting the allowed origin (not `*`, if you need credentials).
Absent headers are the bug — the browser would suppress the response body even though `curl` shows a
perfectly normal `200`.

## 10. Checklist

- [ ] Confirm a browser on a different origin actually calls this API. If not, CORS fixes nothing.
- [ ] Consider serving the UI from the API's own origin instead — then no CORS is needed at all.
- [ ] Decide the allowlist and where it is configured.
- [ ] Handle preflight `OPTIONS` **before** the rate limiter.
- [ ] Send `Vary: Origin` with any reflected origin.
- [ ] Keep `*` and `Allow-Credentials` mutually exclusive.
- [ ] Expose any custom response header browser JS must read.
- [ ] Verify the headers with `curl`; verify the behaviour in a real browser.

## Related learning

- [`pagination-learnings.md`](./pagination-learnings.md) — §4 covers the `Expose-Headers` dependency of header-based pagination metadata.
- [`docker-microservices-containers-learnings.md`](./docker-microservices-containers-learnings.md) — how the containers reach each other; that traffic is server-to-server and never subject to CORS.
- [`new-projects-structure-n-secure-bests-practices.md`](./new-projects-structure-n-secure-bests-practices.md) — what actually protects what, for the secrets/threat-model counterpart of the "CORS is not security" correction.
- `TODO.md:30` — the open *Add CORS configuration* item; `TODO.md:29` — the open auth item it interacts with.

(2026-10-13)
