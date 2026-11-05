import { GitBranch } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-6 px-6">
        <Link href="/" className="flex items-center gap-3" aria-label={`${siteConfig.name} home`}>
          <span className="relative flex size-8 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
            <span className="size-3 rounded-[3px] bg-primary" aria-hidden />
          </span>
          <span className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tight">{siteConfig.name}</span>
            <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
              v{siteConfig.version}
            </Badge>
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {siteConfig.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
            <Link href={siteConfig.apiDocsUrl} target="_blank" rel="noreferrer">
              API docs
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={siteConfig.githubUrl} target="_blank" rel="noreferrer">
              <GitBranch aria-hidden />
              <span className="hidden sm:inline">GitHub</span>
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
