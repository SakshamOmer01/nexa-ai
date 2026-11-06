import { NextResponse } from "next/server";

import { apiRequestVoid } from "@/lib/api-client";
import { rejectCrossOrigin } from "@/lib/auth/csrf";
import { clearSessionTokens, getRefreshToken } from "@/lib/auth/session";

/**
 * Revoke the current session family and clear both httpOnly cookies.
 *
 * Logging out locally must always succeed, so an unreachable API is tolerated: the refresh token
 * then stays valid until it expires, but this browser can no longer use it.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) {
    return crossOrigin;
  }

  const refreshToken = await getRefreshToken();

  if (refreshToken) {
    try {
      await apiRequestVoid("auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
        timeoutMs: 5_000,
      });
    } catch (error) {
      console.warn(
        "auth_logout_upstream_failed",
        error instanceof Error ? error.message : "unknown error",
      );
    }
  }

  await clearSessionTokens();
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
