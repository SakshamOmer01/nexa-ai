import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchBackendHealth } from "@/lib/api-client";
import { env } from "@/lib/env";
import type { BackendHealth, DependencyHealth, FrontendHealth } from "@/types/api";

import { GET } from "./route";

vi.mock("@/lib/api-client", () => ({ fetchBackendHealth: vi.fn() }));

const mockedFetchBackendHealth = vi.mocked(fetchBackendHealth);

function dependency(
  name: string,
  status: DependencyHealth["status"] = "up",
  latencyMs: number | null = 1.5,
): DependencyHealth {
  return { name, status, latency_ms: latencyMs, detail: status === "down" ? "timeout" : null };
}

function backendHealth(...dependencies: DependencyHealth[]): BackendHealth {
  return {
    status: dependencies.every((entry) => entry.status === "up") ? "ok" : "degraded",
    service: "Nexa AI API",
    version: "0.1.0",
    environment: "test",
    timestamp: "2026-11-06T00:00:00Z",
    uptime_seconds: 42.5,
    dependencies,
  };
}

async function readBody(response: Response): Promise<FrontendHealth> {
  return (await response.json()) as FrontendHealth;
}

describe("GET /api/health", () => {
  beforeEach(() => {
    mockedFetchBackendHealth.mockReset();
  });

  it("reports ok and folds the backend dependencies into the payload", async () => {
    mockedFetchBackendHealth.mockResolvedValue(
      backendHealth(dependency("database", "up", 2.5), dependency("redis")),
    );

    const response = await GET();
    const body = await readBody(response);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(body.status).toBe("ok");
    expect(body.service).toBe(`${env.NEXT_PUBLIC_APP_NAME} Web`);
    expect(body.version).toBe(env.NEXT_PUBLIC_APP_VERSION);
    expect(body.environment).toBe(process.env.NODE_ENV);
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
    expect(body.uptime_seconds).toBeGreaterThanOrEqual(0);
    expect(body.dependencies).toEqual([
      { name: "backend-api", status: "up", latency_ms: null, detail: null },
      dependency("database", "up", 2.5),
      dependency("redis"),
    ]);
  });

  it("stays 200 but degrades when the backend is unreachable", async () => {
    mockedFetchBackendHealth.mockResolvedValue(null);

    const response = await GET();
    const body = await readBody(response);

    // A dead backend must not make the web container look dead to its own probe.
    expect(response.status).toBe(200);
    expect(body.status).toBe("degraded");
    expect(body.dependencies).toEqual([
      { name: "backend-api", status: "down", latency_ms: null, detail: "unreachable" },
    ]);
  });

  it("degrades when the backend answers but one of its dependencies is down", async () => {
    mockedFetchBackendHealth.mockResolvedValue(
      backendHealth(dependency("database"), dependency("redis", "down", null)),
    );

    const body = await readBody(await GET());

    expect(body.status).toBe("degraded");
    expect(body.dependencies.map((entry) => [entry.name, entry.status])).toEqual([
      ["backend-api", "up"],
      ["database", "up"],
      ["redis", "down"],
    ]);
  });
});
