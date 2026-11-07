import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { AppShell } from "@/components/workspace/app-shell";
import { getSessionUser } from "@/lib/auth/session";
import { WorkspaceProvider } from "@/lib/workspace/provider";

/**
 * Every workspace route is private. The proxy already redirects signed-out navigations; this guard
 * is the defence that does not depend on middleware configuration, and it supplies the public user
 * projection the client store is namespaced by.
 */
export async function WorkspaceGuard({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <WorkspaceProvider user={user}>
      <AppShell>{children}</AppShell>
    </WorkspaceProvider>
  );
}

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<WorkspaceLoading />}>
      <WorkspaceGuard>{children}</WorkspaceGuard>
    </Suspense>
  );
}

export function WorkspaceLoading() {
  return (
    <div className="flex min-h-dvh bg-background" aria-busy="true" aria-live="polite">
      <div className="hidden w-72 shrink-0 border-r border-sidebar-border bg-sidebar p-4 lg:block">
        <div className="h-8 w-32 animate-pulse rounded-md bg-muted" />
        <div className="mt-6 h-9 animate-pulse rounded-lg bg-muted" />
        <div className="mt-3 h-8 animate-pulse rounded-lg bg-muted" />
        <div className="mt-6 space-y-2">
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="h-7 animate-pulse rounded-md bg-muted/70" />
          ))}
        </div>
      </div>
      <div className="flex min-h-dvh flex-1 flex-col p-6">
        <div className="h-5 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-6 flex-1 animate-pulse rounded-2xl bg-muted/50" />
      </div>
      <span className="sr-only">Loading your workspace…</span>
    </div>
  );
}
