import { ArrowLeft, KeyRound, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { siteConfig } from "@/config/site";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your authenticated Nexa AI account.",
};

export default function DashboardPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-16">
        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardContent />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-live="polite">
      <div className="space-y-3">
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        <div className="h-8 w-72 animate-pulse rounded bg-muted" />
        <div className="h-4 w-56 animate-pulse rounded bg-muted" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-64 animate-pulse rounded-xl bg-muted/60" />
        <div className="h-64 animate-pulse rounded-xl bg-muted/60" />
      </div>
    </div>
  );
}

async function DashboardContent() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const displayName = user.full_name ?? user.email.split("@")[0];
  const memberSince = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(user.created_at));

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">Account</p>
          <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Welcome back, {displayName}
          </h1>
          <p className="text-sm text-muted-foreground">
            Signed in as <span className="font-mono text-xs text-foreground/90">{user.email}</span>
          </p>
        </div>
        <Badge
          variant="outline"
          className="border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
        >
          <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden />
          Authenticated
        </Badge>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border/70 bg-card/60">
          <CardHeader className="border-b border-border/60">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <ShieldCheck className="size-4 text-primary" aria-hidden />
              Profile
            </CardTitle>
            <CardDescription className="text-xs">
              The account behind the current bearer token.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-border/50 text-sm">
              <div className="flex items-center justify-between gap-4 py-2.5">
                <dt className="text-muted-foreground">Name</dt>
                <dd className="truncate text-foreground">{user.full_name ?? "Not set"}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-2.5">
                <dt className="text-muted-foreground">Email</dt>
                <dd className="truncate font-mono text-xs text-foreground">{user.email}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-2.5">
                <dt className="text-muted-foreground">Member since</dt>
                <dd className="text-foreground">{memberSince}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-2.5">
                <dt className="text-muted-foreground">User ID</dt>
                <dd className="max-w-44 truncate font-mono text-[11px] text-muted-foreground" title={user.id}>
                  {user.id}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/60">
          <CardHeader className="border-b border-border/60">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <KeyRound className="size-4 text-primary" aria-hidden />
              Session
            </CardTitle>
            <CardDescription className="text-xs">
              This page was rendered from a protected API call.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs leading-relaxed text-muted-foreground">
              The JWT issued at sign-in is stored in an httpOnly, SameSite=Lax cookie. Browser
              JavaScript cannot read it, and every server render validates it against:
            </p>
            <pre className="overflow-x-auto rounded-lg border border-border/60 bg-background/60 p-3 font-mono text-[11px] leading-relaxed text-foreground/90">
              <code>{`GET /api/v1/auth/me\nAuthorization: Bearer <token>`}</code>
            </pre>
            <p className="text-xs leading-relaxed text-muted-foreground">
              The access token is short-lived. A refresh token in a second httpOnly cookie renews it
              silently; signing out revokes that session and clears both cookies.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/">
            <ArrowLeft aria-hidden />
            Back to overview
          </Link>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href={siteConfig.apiDocsUrl} target="_blank" rel="noreferrer">
            API docs
          </Link>
        </Button>
        <SignOutButton />
      </div>
    </div>
  );
}
