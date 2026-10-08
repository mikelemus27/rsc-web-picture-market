import { describe, expect, spyOn, test } from "bun:test";
import { handleHealth } from "../src/infraestructura/adaptadores/input/http/HealthHandler";

describe("health HTTP handler", () => {
  test("returns 200 with status ok when the probe resolves", async () => {
    const response = await handleHealth("GET", async () => ({ rows: [] }));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(await response.json()).toEqual({ status: "ok" });
  });

  test("returns 503 with status unavailable when the probe rejects", async () => {
    const errorLog = spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await handleHealth("GET", async () => {
        throw new Error("connection refused");
      });

      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ status: "unavailable" });
    } finally {
      errorLog.mockRestore();
    }
  });

  test("logs the failure through the injected logger", async () => {
    const error = new Error("connection refused");
    const logger = { error: (...args: unknown[]) => {} };
    const errorLog = spyOn(logger, "error").mockImplementation(() => {});
    try {
      const response = await handleHealth(
        "GET",
        async () => {
          throw error;
        },
        logger,
      );

      expect(response.status).toBe(503);
      expect(errorLog).toHaveBeenCalledWith("Health check failed:", error);
    } finally {
      errorLog.mockRestore();
    }
  });

  test("logs the failure to console.error when no logger is injected", async () => {
    const error = new Error("connection refused");
    const errorLog = spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await handleHealth("GET", async () => {
        throw error;
      });

      expect(response.status).toBe(503);
      expect(errorLog).toHaveBeenCalledWith("Health check failed:", error);
    } finally {
      errorLog.mockRestore();
    }
  });

  test("returns 405 for non-GET methods without calling the probe", async () => {
    const probe = async () => {
      throw new Error("Should not call the probe for a non-GET request");
    };

    const response = await handleHealth("POST", probe);

    expect(response.status).toBe(405);
    expect(await response.json()).toEqual({ error: "Method Not Allowed" });
  });
});
