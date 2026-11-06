import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequestVoid } from "@/lib/api-client";
import { clearSessionTokens, getRefreshToken } from "@/lib/auth/session";

import { POST } from "./route";

vi.mock("@/lib/api-client", () => ({ apiRequestVoid: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  getRefreshToken: vi.fn(),
  clearSessionTokens: vi.fn(),
}));

const mockedApiRequestVoid = vi.mocked(apiRequestVoid);
const mockedGetRefreshToken = vi.mocked(getRefreshToken);
const mockedClearSessionTokens = vi.mocked(clearSessionTokens);

function logoutRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost:3000/api/auth/logout", { method: "POST", headers });
}

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    mockedApiRequestVoid.mockReset().mockResolvedValue(undefined);
    mockedGetRefreshToken.mockReset().mockResolvedValue("refresh-abc");
    mockedClearSessionTokens.mockReset().mockResolvedValue(undefined);
  });

  it("revokes the session family and clears both cookies", async () => {
    const response = await POST(logoutRequest());

    expect(mockedApiRequestVoid).toHaveBeenCalledExactlyOnceWith("auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: "refresh-abc" }),
      timeoutMs: 5_000,
    });
    expect(mockedClearSessionTokens).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("clears the cookies without a round trip when no refresh token is stored", async () => {
    mockedGetRefreshToken.mockResolvedValue(null);

    const response = await POST(logoutRequest());

    expect(mockedApiRequestVoid).not.toHaveBeenCalled();
    expect(mockedClearSessionTokens).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
  });

  it("still signs the browser out when the backend cannot be reached", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockedApiRequestVoid.mockRejectedValue(new Error("fetch failed"));

    const response = await POST(logoutRequest());

    // Local logout must always succeed, otherwise the visitor is stuck signed in.
    expect(warn).toHaveBeenCalledWith("auth_logout_upstream_failed", "fetch failed");
    expect(mockedClearSessionTokens).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("describes a non-Error rejection as an unknown upstream failure", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // Not every rejection is an Error (aborted fetches, thrown strings from a shim).
    mockedApiRequestVoid.mockRejectedValue("socket hang up");

    const response = await POST(logoutRequest());

    expect(warn).toHaveBeenCalledWith("auth_logout_upstream_failed", "unknown error");
    expect(mockedClearSessionTokens).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
  });

  it("rejects a cross-origin logout without touching cookies or the backend", async () => {
    const response = await POST(logoutRequest({ Origin: "https://evil.example" }));

    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "csrf_rejected" },
    });
    expect(mockedApiRequestVoid).not.toHaveBeenCalled();
    expect(mockedClearSessionTokens).not.toHaveBeenCalled();
  });
});
