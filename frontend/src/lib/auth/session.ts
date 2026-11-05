import { cookies } from "next/headers";

import { apiRequest } from "@/lib/api-client";
import type { AuthTokenResponse, AuthUser } from "@/types/api";

import { REFRESH_COOKIE, SESSION_COOKIE } from "./constants";
import { sessionCookies } from "./cookies";

/**
 * Session helpers.
 *
 * Tokens never reach the browser: they live in httpOnly cookies set by the auth BFF routes and are
 * only read by server code. `import` of `next/headers` also makes this module impossible to bundle
 * for the client. Rotation and revocation happen through the backend; `src/proxy.ts` refreshes an
 * expired access cookie before a page renders.
 */

/** Read the raw access token, or `null` when the visitor is signed out. */
export async function getSessionToken(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

/** Read the refresh token, or `null` for sessions created before refresh tokens existed. */
export async function getRefreshToken(): Promise<string | null> {
  return (await cookies()).get(REFRESH_COOKIE)?.value ?? null;
}

/** Persist a freshly issued token pair. Only valid inside a route handler or server function. */
export async function setSessionTokens(tokens: AuthTokenResponse): Promise<void> {
  const jar = await cookies();
  for (const cookie of sessionCookies(tokens)) {
    jar.set(cookie);
  }
}

/** Remove both session cookies. Revocation of the server-side token is a separate step. */
export async function clearSessionTokens(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(REFRESH_COOKIE);
}

/**
 * Resolve the signed-in user by calling the protected API route with the session token.
 *
 * Returns `null` for a missing, expired or otherwise rejected token, and also when the API is
 * unreachable, so chrome such as the header degrades to the signed-out state instead of failing
 * the whole page.
 */
export async function getSessionUser(): Promise<AuthUser | null> {
  const token = await getSessionToken();
  if (!token) {
    return null;
  }

  try {
    return await apiRequest<AuthUser>("auth/me", {
      headers: { Authorization: `Bearer ${token}` },
      timeoutMs: 3_000,
    });
  } catch {
    return null;
  }
}
