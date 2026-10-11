import { afterAll, beforeAll, describe, expect, test } from "bun:test";

/*
  Server bootstrap test — TODO.md #3 / issue #43.
  Proves the server listens on process.env.PORT when set, by spawning
  src/index.ts with PORT=45991 and polling /health on that port.
  Any HTTP status proves the listener is up (503 is fine when the DB
  probe fails, 200 when it succeeds); the test only needs the port to
  answer. A fixed high port avoids colliding with any dev server on 4001.
*/

const PORT = 45991;
const BASE_URL = `http://localhost:${PORT}`;

let server: Bun.Subprocess | null = null;

async function waitForServer(timeoutMs = 10_000): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/health`);
      return response.status; // any status proves the server answers here
    } catch (error) {
      lastError = error;
      await Bun.sleep(200);
    }
  }
  throw new Error(
    `server did not answer on PORT=${PORT} within ${timeoutMs}ms: ${lastError}`,
  );
}

beforeAll(async () => {
  server = Bun.spawn(["bun", "run", "src/index.ts"], {
    cwd: import.meta.dir + "/..",
    env: { ...process.env, PORT: String(PORT) },
    stdout: "pipe",
    stderr: "pipe",
  });
});

afterAll(async () => {
  server?.kill();
  const exited = await server?.exited;
  if (exited && exited !== 0) {
    console.error(`server exited with code ${exited}`);
  }
});

describe("server port configuration", () => {
  test("starts on process.env.PORT when set", async () => {
    const status = await waitForServer();
    expect([200, 503]).toContain(status);
  });
});