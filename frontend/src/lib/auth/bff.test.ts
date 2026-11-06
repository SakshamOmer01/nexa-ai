import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClientError, apiRequest } from "@/lib/api-client";
import { handleCredentials } from "@/lib/auth/bff";
import { setSessionTokens } from "@/lib/auth/session";
import type { AuthTokenResponse, AuthUser } from "@/types/api";

const setSessionTokensMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({ setSessionTokens: setSessionTokensMock }));
// Keep the real ApiClientError so the handler's `instanceof` branch is exercised.
vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiRequest: vi.fn() };
});

const mockedApiRequest = vi.mocked(apiRequest);
const mockedSetSessionTokens = vi.mocked(setSessionTokens);

const user: AuthUser = {
  id: "8d3c1c1e-5d3f-4a1c-9a5e-6f0b1f2c3d4e",
  email: "ada@example.com",
  full_name: "Ada Lovelace",
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
};

const tokens: AuthTokenResponse = {
  access_token: "access-token",
  refresh_token: "refresh-token",
  token_type: "bearer",
  expires_in: 900,
  refresh_expires_in: 604_800,
  user,
};

function credentialRequest(url: string, body: string): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

async function bodyOf(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe("handleCredentials", () => {
  beforeEach(() => {
    mockedApiRequest.mockReset();
    mockedSetSessionTokens.mockReset();
  });

  it("rejects a body that is not JSON without touching the backend", async () => {
    const response = await handleCredentials(
      "auth/login",
      credentialRequest("http://localhost:3000/api/auth/login", "email=ada"),
    );

    expect(response.status).toBe(400);
    expect(await bodyOf(response)).toMatchObject({
      error: { code: "invalid_request", detail: "Request body must be valid JSON." },
    });
    expect(mockedApiRequest).not.toHaveBeenCalled();
  });

  it("proxies login credentials, stores the tokens and returns only the public user", async () => {
    mockedApiRequest.mockResolvedValue(tokens);

    const response = await handleCredentials(
      "auth/login",
      credentialRequest(
        "http://localhost:3000/api/auth/login",
        JSON.stringify({ email: "ada@example.com", password: "correct-horse" }),
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    // Tokens stay server-side; the browser only ever sees the user projection.
    expect(await bodyOf(response)).toEqual({ user });
    expect(mockedApiRequest).toHaveBeenCalledWith("auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "ada@example.com", password: "correct-horse" }),
      timeoutMs: 10_000,
    });
    expect(mockedSetSessionTokens).toHaveBeenCalledWith(tokens);
  });

  it("answers 201 for signup", async () => {
    mockedApiRequest.mockResolvedValue(tokens);

    const response = await handleCredentials(
      "auth/signup",
      credentialRequest(
        "http://localhost:3000/api/auth/signup",
        JSON.stringify({ email: "ada@example.com", password: "correct-horse" }),
      ),
    );

    expect(response.status).toBe(201);
  });

  it("forwards a backend rejection with its status, code and detail", async () => {
    mockedApiRequest.mockRejectedValue(
      new ApiClientError("Invalid email or password.", 401, "invalid_credentials"),
    );

    const response = await handleCredentials(
      "auth/login",
      credentialRequest(
        "http://localhost:3000/api/auth/login",
        JSON.stringify({ email: "ada@example.com", password: "wrong" }),
      ),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await bodyOf(response)).toMatchObject({
      error: { code: "invalid_credentials", detail: "Invalid email or password." },
    });
    expect(mockedSetSessionTokens).not.toHaveBeenCalled();
  });

  it("reports an unreachable backend as 503 instead of a 500", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockedApiRequest.mockRejectedValue(new TypeError("fetch failed"));

    const response = await handleCredentials(
      "auth/login",
      credentialRequest(
        "http://localhost:3000/api/auth/login",
        JSON.stringify({ email: "ada@example.com", password: "correct-horse" }),
      ),
    );

    expect(response.status).toBe(503);
    expect(await bodyOf(response)).toMatchObject({
      error: {
        code: "auth_unavailable",
        detail: "Authentication service is unavailable. Please try again shortly.",
      },
    });
    expect(consoleError).toHaveBeenCalledWith("auth_upstream_unavailable", "fetch failed");
    expect(mockedSetSessionTokens).not.toHaveBeenCalled();
  });
});
