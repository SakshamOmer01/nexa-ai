import { cookies } from "next/headers";

import { apiRequest } from "@/lib/api-client";
import { env } from "@/lib/env";
import type { AuthUser } from "@/types/api";

import { SESSION_COOKIE } from "./constants";

/**
 * Session helpers.
 *
 * The access token never reaches the browser: it lives in an httpOnly cookie set by the auth BFF
 * routes and is only read by server code. `import` of `next/headers` also makes this module
 * impossible to bundle for the client.
 */

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: env.NEXT_PUBLIC_SITE_URL.startsWith("https://"),
  path: "/",
  priority: "high",
} as const;

/** Read the raw bearer token, or `null` when the visitor is signed out. */
export async function getSessionToken(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

/** Persist a freshly issued token. Only valid inside a route handler or server function. */
export async function setSessionToken(token: string, expiresIn: number): Promise<void> {
  (await cookies()).set({
    name: SESSION_COOKIE,
    value: token,
    ...cookieOptions,
    maxAge: expiresIn,
  });
}

/** Remove the session cookie. */
export async function clearSessionToken(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
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
