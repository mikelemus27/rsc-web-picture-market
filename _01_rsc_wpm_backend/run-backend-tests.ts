const testFile = "test/usuarios.api.test.ts";
const args = Bun.argv.slice(2);

if (args.length > 1 || (args.length === 1 && args[0] !== "--container" && args[0] !== "--help")) {
  console.error("Usage: bun run test:all [-- --container | --help]");
  process.exit(2);
}

if (args[0] === "--help") {
  console.log([
    "Run backend API tests locally:",
    "  bun run test:all",
    "",
    "Run backend API tests inside the running Compose backend container:",
    "  bun run test:all -- --container",
  ].join("\n"));
  process.exit(0);
}

const inContainer = args[0] === "--container";

console.log(inContainer
  ? "Running backend tests inside the Compose backend container against http://localhost:4001..."
  : `Running backend tests locally against ${process.env.TEST_URL ?? "http://localhost:4001"}...`);

async function run(command: string[]): Promise<number> {
  const process = Bun.spawn(command, {
    cwd: import.meta.dir,
    stdout: "inherit",
    stderr: "inherit",
  });
  return await process.exited;
}

if (!inContainer) {
  process.exitCode = await run(["bun", "test", testFile]);
} else {
  const containerTestFile = `/tmp/backend-api-test-${process.pid}.ts`;
  const copied = await run(["docker", "compose", "cp", testFile, `backend:${containerTestFile}`]);

  if (copied !== 0) {
    process.exitCode = copied;
  } else {
    try {
      process.exitCode = await run([
        "docker",
        "compose",
        "exec",
        "-T",
        "-e",
        "TEST_URL=http://localhost:4001",
        "-e",
        "API_URL=http://localhost:4001",
        "backend",
        "bun",
        "test",
        containerTestFile,
      ]);
    } finally {
      const removed = await run([
        "docker",
        "compose",
        "exec",
        "-T",
        "-u",
        "0",
        "backend",
        "rm",
        "-f",
        containerTestFile,
      ]);
      if (removed !== 0) {
        console.error(`Could not remove temporary test file ${containerTestFile} from the container.`);
        if (process.exitCode === 0) process.exitCode = removed;
      }
    }
  }
}
