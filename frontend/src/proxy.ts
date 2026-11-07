import { NextResponse, type NextRequest } from "next/server";

import { apiRequest } from "@/lib/api-client";
import { REFRESH_COOKIE, SESSION_COOKIE } from "@/lib/auth/constants";
import { isAccessTokenFresh, sessionCookies } from "@/lib/auth/cookies";
import type { AuthTokenResponse } from "@/types/api";

/**
 * Session maintenance and optimistic route protection.
 *
 * When the access cookie is missing or about to expire, the refresh token is rotated against the
 * API before the page renders, and the new pair is written to the response and forwarded to the
 * current request. Authorization itself stays with the API: a forged cookie only yields a 401.
 *
 * A failed refresh never clears cookies. The token may have been rotated by a concurrent request
 * (rejected during the replay grace period) or the API may be briefly unavailable; keeping the
 * cookies lets the next navigation recover, and an invalid refresh token is harmless.
 */

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/chat",
  "/code",
  "/documents",
  "/analytics",
  "/settings",
  "/profile",
];
const REFRESH_TIMEOUT_MS = 3_000;

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

async function rotateSession(refreshToken: string): Promise<AuthTokenResponse | null> {
  try {
    return await apiRequest<AuthTokenResponse>("auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
      timeoutMs: REFRESH_TIMEOUT_MS,
    });
  } catch {
    return null;
  }
}

function forwardedCookieHeader(request: NextRequest, tokens: AuthTokenResponse): string {
  const pairs = request.cookies
    .getAll()
    .filter((cookie) => cookie.name !== SESSION_COOKIE && cookie.name !== REFRESH_COOKIE)
    .map((cookie) => `${cookie.name}=${cookie.value}`);

  pairs.push(
    `${SESSION_COOKIE}=${tokens.access_token}`,
    `${REFRESH_COOKIE}=${tokens.refresh_token}`,
  );
  return pairs.join("; ");
}

export async function proxy(request: NextRequest) {
  const accessToken = request.cookies.get(SESSION_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  const needsRefresh = Boolean(refreshToken) && (!accessToken || !isAccessTokenFresh(accessToken));

  const rotated = needsRefresh && refreshToken ? await rotateSession(refreshToken) : null;
  const signedIn = Boolean(rotated?.access_token ?? accessToken);

  if (!signedIn && isProtected(request.nextUrl.pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  if (!rotated) {
    return NextResponse.next();
  }

  const headers = new Headers(request.headers);
  headers.set("cookie", forwardedCookieHeader(request, rotated));

  const response = NextResponse.next({ request: { headers } });
  for (const cookie of sessionCookies(rotated)) {
    response.cookies.set(cookie);
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
