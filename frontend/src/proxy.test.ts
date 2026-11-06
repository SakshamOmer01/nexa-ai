import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "@/lib/api-client";
import type { AuthTokenResponse, AuthUser } from "@/types/api";

import { config, proxy } from "@/proxy";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiRequest: vi.fn() };
});

const mockedApiRequest = vi.mocked(apiRequest);

const user: AuthUser = {
  id: "8d3c1c1e-5d3f-4a1c-9a5e-6f0b1f2c3d4e",
  email: "ada@example.com",
  full_name: null,
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
};

function base64url(value: unknown): string {
  return btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Only the `exp` claim is inspected, so an unsigned JWT-shaped string is enough. */
function accessTokenExpiringIn(seconds: number): string {
  const exp = Math.floor(Date.now() / 1000) + seconds;
  return `${base64url({ alg: "HS256", typ: "JWT" })}.${base64url({ exp, sub: user.id })}.signature`;
}

function rotated(accessToken: string, refreshToken: string): AuthTokenResponse {
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "bearer",
    expires_in: 900,
    refresh_expires_in: 604_800,
    user,
  };
}

function request(path: string, cookies: Record<string, string> = {}): NextRequest {
  const header = Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
  return new NextRequest(`http://localhost:3000${path}`, header ? { headers: { cookie: header } } : undefined);
}

/** Next.js forwards overridden request headers to the route as `x-middleware-request-*`. */
function forwardedCookieHeader(response: Response): string {
  return response.headers.get("x-middleware-request-cookie") ?? "";
}

describe("proxy", () => {
  beforeEach(() => {
    mockedApiRequest.mockReset();
  });

  it("passes unsigned visitors through public pages", async () => {
    const response = await proxy(request("/"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("location")).toBeNull();
    expect(mockedApiRequest).not.toHaveBeenCalled();
  });

  it("redirects unsigned visitors away from /dashboard", async () => {
    const response = await proxy(request("/dashboard/settings?tab=api"));

    expect(response.status).toBe(307);
    // Query strings are dropped so the login page starts clean.
    expect(response.headers.get("location")).toBe("http://localhost:3000/login");
  });

  it("does not refresh or redirect while the access token is still fresh", async () => {
    const access = accessTokenExpiringIn(600);
    const response = await proxy(request("/dashboard", { nexa_access_token: access }));

    expect(response.status).toBe(200);
    expect(mockedApiRequest).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("rotates an expiring session, storing and forwarding the new token pair", async () => {
    const stale = accessTokenExpiringIn(10);
    mockedApiRequest.mockResolvedValue(rotated("new-access", "new-refresh"));

    const response = await proxy(
      request("/dashboard", {
        nexa_access_token: stale,
        nexa_refresh_token: "old-refresh",
        theme: "dark",
      }),
    );

    expect(mockedApiRequest).toHaveBeenCalledWith("auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: "old-refresh" }),
      timeoutMs: 3_000,
    });
    // New cookies are returned to the browser...
    expect(response.cookies.get("nexa_access_token")?.value).toBe("new-access");
    expect(response.cookies.get("nexa_refresh_token")?.value).toBe("new-refresh");
    // ...and the current render sees them too, without losing unrelated cookies.
    expect(response.headers.get("x-middleware-override-headers")).toContain("cookie");
    const forwarded = forwardedCookieHeader(response);
    expect(forwarded).toContain("nexa_access_token=new-access");
    expect(forwarded).toContain("nexa_refresh_token=new-refresh");
    expect(forwarded).toContain("theme=dark");
    expect(forwarded).not.toContain(stale);
    expect(response.headers.get("location")).toBeNull();
  });

  it("treats an opaque or missing access token as needing a refresh", async () => {
    mockedApiRequest.mockResolvedValue(rotated("new-access", "new-refresh"));

    await proxy(request("/", { nexa_access_token: "not-a-jwt", nexa_refresh_token: "old-refresh" }));

    expect(mockedApiRequest).toHaveBeenCalledTimes(1);
  });

  it("keeps the cookies when a refresh fails, so the next navigation can recover", async () => {
    mockedApiRequest.mockRejectedValue(new Error("Request failed with status 401"));

    const response = await proxy(
      request("/", { nexa_access_token: "not-a-jwt", nexa_refresh_token: "old-refresh" }),
    );

    // A rotated-elsewhere token or a blip must not sign the visitor out.
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects a protected route only once no access cookie is left", async () => {
    mockedApiRequest.mockRejectedValue(new Error("fetch failed"));

    // Protection is optimistic: a stale access cookie still renders the shell and the API answers
    // 401, because authorization is the API's job rather than the middleware's.
    const stale = await proxy(
      request("/dashboard", { nexa_access_token: "not-a-jwt", nexa_refresh_token: "dead-refresh" }),
    );
    expect(stale.status).toBe(200);
    expect(stale.headers.get("location")).toBeNull();

    // Without an access cookie the visitor is signed out even though a dead refresh token lingers.
    const signedOut = await proxy(request("/dashboard", { nexa_refresh_token: "dead-refresh" }));
    expect(signedOut.status).toBe(307);
    expect(signedOut.headers.get("location")).toBe("http://localhost:3000/login");
    expect(signedOut.headers.get("set-cookie")).toBeNull();
  });

  it("skips API routes and static assets via the matcher", () => {
    const [pattern] = config.matcher;
    const matches = (path: string) => new RegExp(`^${pattern}$`).test(path);

    expect(matches("/dashboard")).toBe(true);
    expect(matches("/login")).toBe(true);
    expect(matches("/api/auth/login")).toBe(false);
    expect(matches("/_next/static/chunks/main.js")).toBe(false);
    expect(matches("/favicon.ico")).toBe(false);
    expect(matches("/logo.svg")).toBe(false);
  });
});
