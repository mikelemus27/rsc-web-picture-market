# Pagination learnings

Project: `rsc-web-picture-market` — a Bun + PostgreSQL backend behind a `Bun.serve` router. This
file records what paginating `GET /usuarios` actually involves, discovered while scoping the open
backlog item (2026-10-13).

Use it as a design reference, not a recipe to copy blindly: the SQL facts are general, the
file:line evidence is this repository's state on 2026-10-13. Re-verify the code before trusting a
line number.

## 1. Pagination is undefined without a deterministic `ORDER BY`

This is the prerequisite nobody mentions, and it is why "add `limit`/`offset`" is not a small task.

```sql
-- UsuarioRepositoryImpl.ts:87-98 — the current query
SELECT *
FROM usuario
```

No `ORDER BY`. PostgreSQL does **not** guarantee row order for a query that does not ask for one.
It is not "insertion order because it usually is" — it is unspecified, and the planner is free to
change it as the table, statistics, or plan change.

Put `LIMIT 20 OFFSET 20` on top of that and you do **not** get page 2. You get twenty arbitrary
rows out of a set whose order may differ between the two requests — so across pages a row can be
**returned twice or skipped entirely**, and the client silently loses data. Nothing errors.

The fix is one clause, and it must land **before** any `LIMIT`/`OFFSET` is meaningful:

```sql
SELECT *
FROM usuario
ORDER BY id          -- id is SERIAL PRIMARY KEY: unique, so a total order exists
LIMIT $1 OFFSET $2
```

Take the sort key from a column that is unique (`id` here). A non-unique sort key (`nombre`,
`email`... email happens to be unique in this schema, but a name is not) leaves ties unresolved —
`ORDER BY nombre` alone does not define which of two "Ana" rows comes first, so pages can still
overlap. With ties, add a tiebreaker: `ORDER BY nombre, id`.

## 2. Offset vs keyset (cursor) pagination

| | Offset (`LIMIT n OFFSET k`) | Keyset / cursor (`WHERE id > $last ORDER BY id LIMIT n`) |
| --- | --- | --- |
| Jump to page N | Yes, trivially | No — sequential only |
| Stable under concurrent INSERT/DELETE | **No** — rows shift, so pages duplicate or skip | **Yes** — the cursor is a value, not a position |
| Cost at deep pages | O(k): the executor still produces and discards the first k rows | O(log n): an index range scan from the cursor |
| Total count | Natural to provide | Needs a separate query, and it drifts as data changes |
| Sort key requirement | Any | Must be unique and ordered (and ideally monotonic) |
| Complexity | Trivial | Moderate — the cursor has to be encoded if it is composite |

Offset is the right default for a small table and a reference app; it is the wrong choice for a
deep, write-heavy feed. Decide explicitly rather than defaulting.

**The `LIMIT n + 1` trick** gives `hasNext` with no `COUNT(*)` at all: request one more row than
you intend to return; if `n + 1` rows come back, `hasNext` is true and you drop the extra row.

```ts
const rows = await repo.findPage({ limit: limit + 1, offset });
const hasNext = rows.length > limit;
return { items: rows.slice(0, limit), hasNext };
```

## 3. Where the metadata lives — the contract decision

The real fork is not the SQL; it is whether a client that **ignores** pagination can fail
silently. Three shapes exist:

**A. Envelope (breaking): `{ data: [...], pagination: { limit, offset, total } }`**

- Good: the limit is in-band, so truncation is visible; typed end to end; later additions
  (`hasNext`, `nextCursor`, `links`) are additive and never break again; one artifact to test and
  document; no CORS dependency.
- Bad: breaks every consumer that assumes an array; needs a new type; bigger diff.

**B. Array + headers (additive): keep `[...]`, send `X-Total-Count` / `Link`**

- Good: non-breaking, smallest slice, recognizable convention (`X-Total-Count` is de facto, not
  standardized; `Link` is RFC 8288 Web Linking).
- Bad: **silent truncation is the default failure mode** — a client sees 20 rows with no in-band
  hint of the other 420; headers are invisible to TypeScript (hand-parsed strings, silent `NaN` on
  a rename); enforces the contract in two places; and see the CORS trap in §4.

**C. Opt-in: legacy array by default, envelope only when `?limit`/`offset`/`?paged=true` is sent**

- Good: non-breaking by construction.
- Bad: two response shapes forever. Every consumer must branch, the contract is ambiguous, and the
  tax ends only when one shape is deprecated — by which point both were paid for.

## 4. Two traps that decide the shape in practice

**The CORS trap.** Browser JavaScript cannot read **custom response headers** cross-origin unless
the server sends `Access-Control-Expose-Headers` for them. This repository has **no CORS
configuration at all** (no `access-control` / `cors` string in `_01_rsc_wpm_backend/src`), which is
exactly why "Add CORS configuration" is still open in `TODO.md`. So under option B the metadata is
**unreachable from any browser client** until CORS lands *and* someone remembers to expose the
header. Body metadata has no such dependency. (`Content-Length`, `Content-Type` and a few others
are CORS-safelisted; `X-Total-Count` is not.)

**The typing trap.** Headers are not visible to the type system. `res.headers.get("X-Total-Count")`
returns `string | null`; converting it means `Number(...)`, which silently yields `NaN` when the
header is absent or renamed. A body envelope gets a declared TypeScript type instead.

## 5. The failure mode to watch for: silent truncation

With a default limit, `GET /usuarios` starts returning a *correct-looking* partial list. Nothing
errors; the response is `200` and the JSON is valid. The symptom appears later as "why does the
list only show the first 20 users?" — usually after a client was written against the unpaginated
version. Mitigations, in order of strength: metadata in-band (option A), `hasNext`, and a
documented default. A header nobody reads mitigates nothing.

## 6. Validating the query parameters

`?limit=` and `?offset=` are untrusted strings, and the obvious coercions are traps:

| Input | `Number(x)` | `parseInt(x, 10)` |
| --- | --- | --- |
| `"abc"` | `NaN` | `NaN` |
| `""` (e.g. `?limit=`) | **`0`** — silently valid-looking | `NaN` |
| `"  "` | `0` | `NaN` |
| `"12.5"` | `12.5` — not an integer | `12` |
| `"12abc"` | `NaN` | **`12`** — silently lenient |

So: parse, then check `Number.isInteger(...)`, then check the range. Two policies are defensible
and should be chosen deliberately:

- **Omitted → default; malformed → `400`** with a message. Consistent with this repository's
  existing convention, where validation failures are typed errors mapped to `400` (see the PUT
  handler's `UsuarioValidationError` → `400` mapping).
- **Clamp everything** (malformed or out of range → default). Forgiving, but a typo becomes a
  silently different page size, which is the same class of bug as silent truncation.

Whatever is chosen, cap the maximum (`limit=1000000` must not become a memory event) — for example
default `20`, max `100`. Those numbers are a convention, not a fact: pick them and write them down.

## 7. Counting the total

Two ways, with different costs:

- `SELECT COUNT(*) FROM usuario` — a second round trip. Unless both queries run in one
  transaction (e.g. `REPEATABLE READ`), the **count and the rows come from different snapshots**,
  so `total` can disagree with the data the client just received.
- `SELECT *, COUNT(*) OVER() AS total FROM usuario ORDER BY id LIMIT $1 OFFSET $2` — one round
  trip and one consistent snapshot, but window functions are evaluated **before** `LIMIT`, so the
  query computes over the whole result set anyway. The saving is latency, not work.

If the UI never shows a total, `hasNext` from §2 is cheaper than either.

## 8. What a paginated slice touches in this repository

The constraint propagates from SQL up to the JSON contract, so it is a full vertical slice:

| Layer | File | Change |
| --- | --- | --- |
| SQL | `_01_rsc_wpm_backend/src/infraestructura/adaptadores/output/postgres_sql/UsuarioRepositoryImpl.ts:87-98` | `ORDER BY id`, `LIMIT`/`OFFSET` |
| Output port | `src/aplicacion/ports/output/IUsuarioRepositoryPort.ts:14` | `findAll(): Promise<Usuario[]>` → a paged signature |
| Use case + input port | `src/aplicacion/caso_uso/usuario/listar_usuarios/ListarUsuariosUseCase.ts`, `src/aplicacion/ports/input/usuario/IListarUsuariosUseCase.ts:10` | accept paging, return a page |
| Pass-through service | `src/aplicacion/services/UsuarioService.ts:33-46` | must forward the new params while adding nothing — the concrete cost of the redundant layer tracked as its own backlog item |
| Controller | `src/infraestructura/adaptadores/input/http/UsuarioController.ts:21-23` | forward the params |
| Route | `src/index.ts:184-191` | parse and validate `?limit=&offset=`, serialize the new shape |
| Schema (context) | `_01_rsc_wpm_backend/db/init/01-schema.sql:1-5` | `id SERIAL PRIMARY KEY`, `nombre VARCHAR(100) NOT NULL`, `email VARCHAR(100) UNIQUE NOT NULL` |

**Consumers that break** (both assert the array):

- `_01_rsc_wpm_backend/test/usuarios.backend.api.test.ts:52-57` — `expect(Array.isArray(data)).toBe(true)`
- `_02_rsc_wp_frontend/tests/usuarios.frontend.api.test.ts:57-62` — the same assertion

**Consumers that survive** an envelope change (easy to overestimate the damage):

- `_02_rsc_wp_frontend/src/users/tests/GetUsuariosTest.ts` only checks `response.status === 200` and
  passes the parsed body straight through — so it keeps passing, but what it displays changes.
- `_02_rsc_wp_frontend/src/core/console/ConsolePrinter.ts:24-27` — `printData` is literally
  `console.log("📊 " + message, data)`, so the list tool would print the whole envelope (arguably
  more informative, still a visible change).

Current state, for the record: a grep for `ORDER BY` / `LIMIT` / `OFFSET` across the backend's
`src` and `test` returns no real hits, and `GET /usuarios` is unbounded end to end.

## 9. Checklist

- [ ] Choose the sort key and add a deterministic `ORDER BY` **first** — nothing else is correct without it.
- [ ] Decide offset vs keyset, and write down why.
- [ ] Decide the response shape (envelope / headers / opt-in) against the silent-truncation axis.
- [ ] Choose default and maximum `limit`; decide malformed-parameter behaviour (`400` vs clamp).
- [ ] Decide whether a total is needed at all; if so, pick `COUNT(*) OVER()` or a transaction.
- [ ] Update the port, use case, controller, route, and every consumer that asserted the old shape.
- [ ] Document the new contract (request params + response shape) where the API is described.

## Related learning

- [`postgresql-learnings.md`](./postgresql-learnings.md) — database readiness, schema initialization, and the SQL layer this rests on.
- [`bun-testing-learnings.md`](./bun-testing-learnings.md) — running the backend suites while changing this contract.
- `TODO.md` — the open *Add pagination to `GET /usuarios`* item, and the open *Add CORS configuration* item that §4 depends on.

(2026-10-13)
