import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApiClientError,
  apiRequest,
  apiRequestVoid,
  fetchBackendHealth,
} from "@/lib/api-client";
import { env } from "@/lib/env";
import type { BackendHealth } from "@/types/api";

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status < 400, status, json: async () => body } as Response;
}

function stubFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function requestInit(fetchMock: ReturnType<typeof vi.fn>): RequestInit {
  return fetchMock.mock.calls[0][1] as RequestInit;
}

const health: BackendHealth = {
  status: "ok",
  service: "backend-api",
  version: "0.1.0",
  environment: "test",
  timestamp: "2026-01-01T00:00:00Z",
  uptime_seconds: 12.5,
  dependencies: [{ name: "postgresql", status: "up", latency_ms: 3, detail: null }],
};

describe("apiRequest", () => {
  beforeEach(() => {
    // An empty value is falsy after trimming, so the request falls back to the public API URL.
    vi.stubEnv("API_INTERNAL_URL", "");
  });

  it("targets the public API origin when no internal URL is configured", async () => {
    const fetchMock = stubFetch(jsonResponse(health));

    await apiRequest("health");

    const expectedBase = env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
    expect(fetchMock.mock.calls[0][0]).toBe(`${expectedBase}/health`);
  });

  it("prefers API_INTERNAL_URL and normalizes its trailing slash", async () => {
    vi.stubEnv("API_INTERNAL_URL", "http://backend:8000/api/v1/");
    const fetchMock = stubFetch(jsonResponse(health));

    await apiRequest("/health");

    expect(fetchMock.mock.calls[0][0]).toBe("http://backend:8000/api/v1/health");
  });

  it("bypasses caches, accepts JSON and forwards caller options", async () => {
    const fetchMock = stubFetch(jsonResponse(health));

    await apiRequest("auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "ada@example.com" }),
    });

    const init = requestInit(fetchMock);
    expect(init.cache).toBe("no-store");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ email: "ada@example.com" }));
    expect(init.headers).toEqual({
      Accept: "application/json",
      "Content-Type": "application/json",
    });
    // Every request is bounded so a hung backend cannot stall a render.
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("returns the parsed JSON body", async () => {
    stubFetch(jsonResponse(health));

    await expect(apiRequest<BackendHealth>("health")).resolves.toEqual(health);
  });

  it("throws an ApiClientError carrying the backend code and detail", async () => {
    stubFetch(
      jsonResponse(
        { error: { code: "invalid_credentials", detail: "Invalid email or password." } },
        401,
      ),
    );

    const error = await apiRequest("auth/login").catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({
      name: "ApiClientError",
      status: 401,
      code: "invalid_credentials",
      message: "Invalid email or password.",
    });
  });

  it("falls back to the status message when the body carries no error object", async () => {
    stubFetch(jsonResponse({ message: "gateway is down" }, 502));

    await expect(apiRequest("health")).rejects.toMatchObject({
      status: 502,
      code: "api_error",
      message: "Request failed with status 502",
    });
  });

  it("keeps the status message when the error object omits a detail", async () => {
    stubFetch(jsonResponse({ error: { code: "rate_limited" } }, 429));

    await expect(apiRequest("health")).rejects.toMatchObject({
      status: 429,
      code: "rate_limited",
      message: "Request failed with status 429",
    });
  });

  it("falls back to a status message when the error body is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new SyntaxError("Unexpected token < in JSON");
        },
      } as unknown as Response),
    );

    await expect(apiRequest("health")).rejects.toMatchObject({
      status: 500,
      code: "api_error",
      message: "Request failed with status 500",
    });
  });
});

describe("apiRequestVoid", () => {
  it("resolves without reading a body", async () => {
    const json = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 204, json } as unknown as Response));

    await expect(apiRequestVoid("auth/logout", { method: "POST" })).resolves.toBeUndefined();
    expect(json).not.toHaveBeenCalled();
  });

  it("throws on an error status", async () => {
    stubFetch(jsonResponse({ error: { code: "forbidden", detail: "Not allowed." } }, 403));

    await expect(apiRequestVoid("auth/logout")).rejects.toMatchObject({
      status: 403,
      code: "forbidden",
      message: "Not allowed.",
    });
  });
});

describe("fetchBackendHealth", () => {
  it("returns null when the backend is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(fetchBackendHealth()).resolves.toBeNull();
  });

  it("returns the readiness snapshot when the backend answers", async () => {
    stubFetch(jsonResponse(health));

    await expect(fetchBackendHealth()).resolves.toEqual(health);
  });
});
