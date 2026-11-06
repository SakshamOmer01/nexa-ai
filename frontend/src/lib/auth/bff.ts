import { NextResponse } from "next/server";

import { ApiClientError, apiRequest } from "@/lib/api-client";
import type { AuthSession, AuthTokenResponse } from "@/types/api";

import { rejectCrossOrigin } from "./csrf";
import { setSessionTokens } from "./session";

/**
 * Credential proxy shared by the login and signup route handlers.
 *
 * The browser talks to this same-origin endpoint; the backend access and refresh tokens are stored
 * in httpOnly cookies and only the public user is returned, so credentials never live in browser
 * storage or JavaScript-readable state.
 */

type CredentialPath = "auth/login" | "auth/signup";

const ERROR_HEADERS = { "Cache-Control": "no-store" } as const;

function errorResponse(status: number, code: string, detail: string): NextResponse {
  return NextResponse.json(
    { error: { code, detail }, request_id: crypto.randomUUID() },
    { status, headers: ERROR_HEADERS },
  );
}

export async function handleCredentials(
  path: CredentialPath,
  request: Request,
): Promise<NextResponse> {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) {
    return crossOrigin;
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return errorResponse(400, "invalid_request", "Request body must be valid JSON.");
  }

  try {
    const token = await apiRequest<AuthTokenResponse>(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      timeoutMs: 10_000,
    });

    await setSessionTokens(token);

    return NextResponse.json<AuthSession>(
      { user: token.user },
      {
        status: path === "auth/signup" ? 201 : 200,
        headers: ERROR_HEADERS,
      },
    );
  } catch (error) {
    if (error instanceof ApiClientError) {
      return errorResponse(error.status, error.code, error.message);
    }
    console.error(
      "auth_upstream_unavailable",
      error instanceof Error ? error.message : "unknown error",
    );
    return errorResponse(
      503,
      "auth_unavailable",
      "Authentication service is unavailable. Please try again shortly.",
    );
  }
}
