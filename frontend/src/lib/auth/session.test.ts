import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "@/lib/api-client";
import {
  clearSessionTokens,
  getRefreshToken,
  getSessionToken,
  getSessionUser,
  setSessionTokens,
} from "@/lib/auth/session";
import type { AuthTokenResponse, AuthUser } from "@/types/api";

const cookieJar = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }));

vi.mock("next/headers", () => ({ cookies: async () => cookieJar }));
vi.mock("@/lib/api-client", () => ({ apiRequest: vi.fn() }));

const mockedApiRequest = vi.mocked(apiRequest);

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

describe("session token cookies", () => {
  beforeEach(() => {
    cookieJar.get.mockReset();
    cookieJar.set.mockReset();
    cookieJar.delete.mockReset();
  });

  it("reads the access and refresh tokens from their cookies", async () => {
    cookieJar.get.mockImplementation((name: string) =>
      name === "nexa_access_token" ? { value: "access-token" } : { value: "refresh-token" },
    );

    await expect(getSessionToken()).resolves.toBe("access-token");
    await expect(getRefreshToken()).resolves.toBe("refresh-token");
  });

  it("returns null for visitors without session cookies", async () => {
    cookieJar.get.mockReturnValue(undefined);

    await expect(getSessionToken()).resolves.toBeNull();
    await expect(getRefreshToken()).resolves.toBeNull();
  });

  it("persists both halves of a freshly issued token pair", async () => {
    await setSessionTokens(tokens);

    expect(cookieJar.set).toHaveBeenCalledTimes(2);
    expect(cookieJar.set.mock.calls.map(([cookie]) => cookie)).toMatchObject([
      { name: "nexa_access_token", value: "access-token", httpOnly: true, maxAge: 900 },
      { name: "nexa_refresh_token", value: "refresh-token", httpOnly: true, maxAge: 604_800 },
    ]);
  });

  it("clears both cookies on sign-out", async () => {
    await clearSessionTokens();

    expect(cookieJar.delete.mock.calls).toEqual([["nexa_access_token"], ["nexa_refresh_token"]]);
  });
});

describe("getSessionUser", () => {
  beforeEach(() => {
    cookieJar.get.mockReset();
    cookieJar.set.mockReset();
    cookieJar.delete.mockReset();
    mockedApiRequest.mockReset();
  });

  it("returns null without calling the API when the visitor is signed out", async () => {
    cookieJar.get.mockReturnValue(undefined);

    await expect(getSessionUser()).resolves.toBeNull();
    expect(mockedApiRequest).not.toHaveBeenCalled();
  });

  it("resolves the viewer with the access token as a bearer credential", async () => {
    cookieJar.get.mockReturnValue({ value: "access-token" });
    mockedApiRequest.mockResolvedValue(user);

    await expect(getSessionUser()).resolves.toEqual(user);
    expect(mockedApiRequest).toHaveBeenCalledWith("auth/me", {
      headers: { Authorization: "Bearer access-token" },
      timeoutMs: 3_000,
    });
  });

  it("degrades to signed-out when the token is rejected or the API is unreachable", async () => {
    cookieJar.get.mockReturnValue({ value: "expired-token" });
    mockedApiRequest.mockRejectedValue(new Error("Request failed with status 401"));

    // The header must render rather than fail the page when the session cannot be resolved.
    await expect(getSessionUser()).resolves.toBeNull();
  });
});
