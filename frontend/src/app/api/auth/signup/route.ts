import { NextResponse } from "next/server";

import { handleCredentials } from "@/lib/auth/bff";

/** Same-origin signup endpoint: creates the account and signs the visitor in. */
export async function POST(request: Request): Promise<NextResponse> {
  return handleCredentials("auth/signup", request);
}
