import { NextResponse } from "next/server";

/**
 * Explicit CSRF defence for the state-changing BFF routes.
 *
 * Cookies are already httpOnly and SameSite=Lax, which browsers refuse to attach to cross-site
 * form posts. That is the primary control; this check is the second one, so a SameSite regression
 * (or a browser that treats a sibling subdomain as same-site) cannot silently turn `/api/auth/*`
 * into a cross-origin credential endpoint.
 *
 * Browsers send `Origin` on every POST and `Sec-Fetch-Site` on every request; non-browser clients
 * (curl, server-to-server calls, the integration suite) send neither, so they are left to the
 * API's own authentication.
 */

const SAFE_FETCH_SITES = new Set(["same-origin", "none"]);

const REJECTION_HEADERS = { "Cache-Control": "no-store" } as const;

function rejection(): NextResponse {
  return NextResponse.json(
    {
      error: { code: "csrf_rejected", detail: "Cross-origin request rejected." },
      request_id: crypto.randomUUID(),
    },
    { status: 403, headers: REJECTION_HEADERS },
  );
}

function matchesRequestOrigin(origin: string, expectedOrigin: string): boolean {
  try {
    // Host casing and default ports are normalised by URL; "null" (sandboxed documents) throws.
    return new URL(origin).origin === expectedOrigin;
  } catch {
    return false;
  }
}

/**
 * Return a 403 response when the request did not originate from this site, otherwise `null`.
 *
 * `Origin` must match the request's own origin exactly, so a sibling subdomain is rejected too.
 * `Sec-Fetch-Site` must be `same-origin` or `none` (a user-initiated navigation) when present.
 */
export function rejectCrossOrigin(request: Request): NextResponse | null {
  let expectedOrigin: string;
  try {
    expectedOrigin = new URL(request.url).origin;
  } catch {
    return rejection();
  }

  const origin = request.headers.get("origin");
  if (origin !== null && !matchesRequestOrigin(origin, expectedOrigin)) {
    return rejection();
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite !== null && !SAFE_FETCH_SITES.has(fetchSite.toLowerCase())) {
    return rejection();
  }

  return null;
}
