import Link from "next/link";

import { siteConfig } from "@/config/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium">{siteConfig.name}</p>
          <p className="text-xs text-muted-foreground">
            Monorepo foundation · v{siteConfig.version} · Built for production
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
          <Link
            href={siteConfig.githubUrl}
            className="text-muted-foreground transition-colors hover:text-foreground"
            target="_blank"
            rel="noreferrer"
          >
            Repository
          </Link>
          <Link
            href={siteConfig.apiDocsUrl}
            className="text-muted-foreground transition-colors hover:text-foreground"
            target="_blank"
            rel="noreferrer"
          >
            OpenAPI reference
          </Link>
          <Link href="/api/health" className="text-muted-foreground transition-colors hover:text-foreground">
            /api/health
          </Link>
        </nav>
      </div>
    </footer>
  );
}
