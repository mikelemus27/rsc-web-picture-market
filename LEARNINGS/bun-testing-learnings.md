# Bun testing learnings

Project: `rsc-web-picture-market` — Bun backend (`_01_rsc_wpm_backend`) test patterns and gotchas, first recorded while implementing issue #52 (rate limiting) and re-running the backend suites.

## 1. "server exited with code 143" is the test's own cleanup — not a failure

Every suite run that includes `test/server-port.test.ts` shows this pair of lines:

```
test/server-port.test.ts:
✓ server port configuration > starts on process.env.PORT when set [1267.50ms]
server exited with code 143
```

**What it is.** `server-port.test.ts` proves the server listens on `process.env.PORT` by spawning a real child server (`Bun.spawn(["bun", "run", "src/index.ts"], { env: { PORT: 45991 } })` in `beforeAll`), polling `GET /health` until any HTTP status answers, and — in `afterAll` — terminating it with `server?.kill()` (SIGTERM) and **deliberately printing** the child's exit status: `if (exited && exited !== 0) console.error("server exited with code ${exited}")`.

**Why 143.** Unix convention: a process killed by signal N reports exit status `128 + N`. 143 = 128 + 15 = died by SIGTERM, the signal the test itself sent. The server is a long-running listener, so it never exits on its own; the kill is the cleanup, and 143 is the proof it happened. It is not a crash and not an application error.

**Why ~1267ms.** The test has to wait for the spawned server to boot and answer the probe: `waitForServer` polls every 200ms (up to a 10s deadline) until `/health` returns any status (200 or 503 both prove the port answers — DB state is irrelevant to the assertion), then the kill runs.

**How to tell it apart from a real failure.** The suite still reports `0 fail` next to it (`test:rate-limit` → 22 pass / 0 fail; `test:all` → 35 pass / 0 fail). A genuine process failure shows failing assertions or a non-143 exit from a server nobody killed.

## 2. Reusable pattern: spawn the real server, probe the port, kill it

`test/server-port.test.ts` is the transferable recipe for any "does the server actually listen" test without external fixtures:

- a fixed high port (`45991`) so the test never collides with a dev server on 4001;
- `env: { ...process.env, PORT: String(PORT) }` at spawn so the bootstrap wiring (`src/index.ts`) is exercised with real configuration;
- probe for *any* HTTP status — the point is liveness on the port, not application success, so the test stays hermetic regarding the database;
- kill in `afterAll` and expect the 143 print; if it ever stops appearing, the cleanup is broken.

(2026-10-13)