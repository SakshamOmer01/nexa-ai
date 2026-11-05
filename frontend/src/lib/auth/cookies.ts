import { env } from "@/lib/env";
import type { AuthTokenResponse } from "@/types/api";

import { REFRESH_COOKIE, SESSION_COOKIE } from "./constants";

/**
 * Cookie definitions shared by route handlers and `src/proxy.ts`.
 *
 * This module must stay free of `next/headers` so middleware can import it. Tokens are httpOnly,
 * SameSite=Lax and secure whenever the site is served over https; neither is readable by browser
 * JavaScript.
 */

/** Refresh slightly before expiry so a request never races the access token's `exp` claim. */
const EXPIRY_SKEW_SECONDS = 30;

export interface SessionCookieSpec {
  name: string;
  value: string;
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  priority: "high";
  maxAge: number;
}

export function sessionCookie(name: string, value: string, maxAge: number): SessionCookieSpec {
  return {
    name,
    value,
    httpOnly: true,
    sameSite: "lax",
    secure: env.NEXT_PUBLIC_SITE_URL.startsWith("https://"),
    path: "/",
    priority: "high",
    maxAge,
  };
}

/** Both cookies for a freshly issued token pair. */
export function sessionCookies(tokens: AuthTokenResponse): SessionCookieSpec[] {
  return [
    sessionCookie(SESSION_COOKIE, tokens.access_token, tokens.expires_in),
    sessionCookie(REFRESH_COOKIE, tokens.refresh_token, tokens.refresh_expires_in),
  ];
}

function decodeJwtExpiry(token: string): number | null {
  const segments = token.split(".");
  if (segments.length !== 3) {
    return null;
  }

  try {
    const base64 = segments[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

/**
 * Whether the access cookie can still be used without a refresh.
 *
 * This only decodes the payload for `exp`; it is not a verification step. The API remains the
 * authority on whether a token is valid, so a forged cookie simply gets a 401 later.
 */
export function isAccessTokenFresh(token: string, nowSeconds = Date.now() / 1000): boolean {
  const expiresAt = decodeJwtExpiry(token);
  return expiresAt !== null && expiresAt - EXPIRY_SKEW_SECONDS > nowSeconds;
}
