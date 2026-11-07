import Link from "next/link";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";

/**
 * Signed-in state for the site header.
 *
 * Server-rendered from the httpOnly session cookie, so the UI never needs the token in the
 * browser. Rendered behind a Suspense boundary in the header because it reads request cookies.
 */
export async function AuthNav() {
  const user = await getSessionUser();

  if (!user) {
    return (
      <>
        <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
          <Link href="/login">Sign in</Link>
        </Button>
        <Button size="sm" asChild className="rounded-full px-4">
          <Link href="/signup">Get started</Link>
        </Button>
      </>
    );
  }

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
        <Link href="/dashboard">Dashboard</Link>
      </Button>
      <Button size="sm" asChild className="rounded-full px-4">
        <Link href="/chat">Open workspace</Link>
      </Button>
      <span
        className="hidden max-w-40 truncate text-xs text-muted-foreground xl:inline"
        title={user.email}
      >
        {user.email}
      </span>
      <SignOutButton />
    </>
  );
}
