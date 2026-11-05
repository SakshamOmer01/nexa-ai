import { NextResponse } from "next/server";

import { handleCredentials } from "@/lib/auth/bff";

/** Same-origin login endpoint: sets the httpOnly session cookie on success. */
export async function POST(request: Request): Promise<NextResponse> {
  return handleCredentials("auth/login", request);
}
