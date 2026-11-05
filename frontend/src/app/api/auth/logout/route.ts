import { NextResponse } from "next/server";

import { clearSessionToken } from "@/lib/auth/session";

/** Clear the httpOnly session cookie. The token itself stays valid until it expires. */
export async function POST(): Promise<NextResponse> {
  await clearSessionToken();
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
