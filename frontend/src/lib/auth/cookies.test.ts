import { afterEach, describe, expect, it, vi } from "vitest";

import { isAccessTokenFresh, sessionCookies } from "@/lib/auth/cookies";
import type { AuthTokenResponse } from "@/types/api";

const tokens: AuthTokenResponse = {
  access_token: "access-token",
  refresh_token: "refresh-token",
  token_type: "bearer",
  expires_in: 900,
  refresh_expires_in: 604_800,
  user: {
    id: "8d3c1c1e-5d3f-4a1c-9a5e-6f0b1f2c3d4e",
    email: "ada@example.com",
    full_name: null,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
  },
};

function base64url(value: unknown): string {
  return btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Build an unsigned JWT-shaped string; only the `exp` claim is ever read. */
function jwt(payload: Record<string, unknown>): string {
  return `${base64url({ alg: "HS256", typ: "JWT" })}.${base64url(payload)}.signature`;
}

describe("sessionCookies", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("mirrors the token pair into hardened cookies", () => {
    const [access, refresh] = sessionCookies(tokens);

    expect(access).toMatchObject({
      name: "nexa_access_token",
      value: "access-token",
      maxAge: 900,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      priority: "high",
      // The default site URL is plain http, so a Secure cookie would never be stored.
      secure: false,
    });
    expect(refresh).toMatchObject({
      name: "nexa_refresh_token",
      value: "refresh-token",
      maxAge: 604_800,
    });
  });

  it("marks cookies secure when the site is served over https", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://nexa.example.com");

    const cookies = await import("@/lib/auth/cookies");

    expect(cookies.sessionCookies(tokens)[0].secure).toBe(true);
  });
});

describe("isAccessTokenFresh", () => {
  const now = 1_000_000;

  it("accepts a token whose expiry is beyond the refresh skew", () => {
    expect(isAccessTokenFresh(jwt({ exp: now + 3_600 }), now)).toBe(true);
  });

  it("rejects an expired token", () => {
    expect(isAccessTokenFresh(jwt({ exp: now - 1 }), now)).toBe(false);
  });

  it("refreshes early instead of racing the expiry", () => {
    // Inside the 30s skew window the token is treated as stale even though it is still valid.
    expect(isAccessTokenFresh(jwt({ exp: now + 30 }), now)).toBe(false);
    expect(isAccessTokenFresh(jwt({ exp: now + 31 }), now)).toBe(true);
  });

  it("rejects values that are not three-segment JWTs", () => {
    expect(isAccessTokenFresh("opaque-session-token", now)).toBe(false);
    expect(isAccessTokenFresh("header.payload", now)).toBe(false);
  });

  it("rejects a payload that cannot be decoded or has no numeric exp", () => {
    expect(isAccessTokenFresh("header.@@@.signature", now)).toBe(false);
    expect(isAccessTokenFresh(jwt({ sub: "user" }), now)).toBe(false);
    expect(isAccessTokenFresh(jwt({ exp: "tomorrow" }), now)).toBe(false);
  });
});
