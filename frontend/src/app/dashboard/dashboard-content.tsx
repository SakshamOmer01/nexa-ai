import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Code2,
  FileText,
  KeyRound,
  MessagesSquare,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { siteConfig } from "@/config/site";
import { getSessionUser } from "@/lib/auth/session";

/**
 * Authenticated dashboard body.
 *
 * Colocated with the page rather than in `src/components`: it reads the session cookie on every
 * render, so it must stay a server component. Living in its own module lets the page compose it
 * behind Suspense while tests can await it directly.
 */
export async function DashboardContent() {
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
          className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        >
          <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
          Authenticated
        </Badge>
      </header>

      <section aria-labelledby="workspace-links" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="workspace-links" className="text-sm font-semibold">
            Your workspace
          </h2>
          <Link href="/chat" className="text-xs font-medium text-primary hover:underline">
            Open assistant
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            {
              href: "/chat",
              icon: MessagesSquare,
              title: "AI chat",
              description: "Ask, draft and iterate with attachments and voice.",
            },
            {
              href: "/documents",
              icon: FileText,
              title: "Documents",
              description: "Keep reference files ready to attach as context.",
            },
            {
              href: "/analytics",
              icon: BarChart3,
              title: "Analytics",
              description: "See the real usage behind your workspace.",
            },
            {
              href: "/code",
              icon: Code2,
              title: "Coding assistant",
              description: "A focused mode for implementation and review.",
            },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group flex items-start gap-3 rounded-xl border border-border/70 bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <item.icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold">{item.title}</span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
                  {item.description}
                </span>
              </span>
              <ArrowRight
                className="mt-1 size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                aria-hidden
              />
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border/70 bg-card">
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

        <Card className="border-border/70 bg-card">
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
