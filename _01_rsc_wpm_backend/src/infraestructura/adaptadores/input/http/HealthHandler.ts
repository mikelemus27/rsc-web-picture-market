export type HealthProbe = () => Promise<unknown>;

type Logger = {
  error: (...args: unknown[]) => void;
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function handleHealth(
  method: string,
  probe: HealthProbe,
  logger: Logger = console,
): Promise<Response> {
  if (method !== "GET") {
    return json({ error: "Method Not Allowed" }, 405);
  }

  try {
    await probe();
    return json({ status: "ok" });
  } catch (error) {
    logger.error("Health check failed:", error);
    return json({ status: "unavailable" }, 503);
  }
}
