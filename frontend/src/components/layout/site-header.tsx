import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { AuthNav } from "@/components/auth/auth-nav";
import { NexaWordmark } from "@/components/brand/nexa-mark";
import { SiteHeaderMobileActions } from "@/components/layout/site-header-actions";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label={`${siteConfig.name} home`} className="rounded-lg">
          <NexaWordmark />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {siteConfig.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <SiteHeaderMobileActions />
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="hidden text-muted-foreground lg:inline-flex"
          >
            <Link href={siteConfig.apiDocsUrl} target="_blank" rel="noreferrer">
              API docs
              <ArrowUpRight aria-hidden />
            </Link>
          </Button>
          <Suspense
            fallback={<span className="h-7 w-32 animate-pulse rounded-md bg-muted/70" aria-hidden />}
          >
            <AuthNav />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
