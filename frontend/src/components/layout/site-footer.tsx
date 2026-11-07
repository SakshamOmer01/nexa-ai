import Link from "next/link";

import { NexaMark } from "@/components/brand/nexa-mark";
import { siteConfig } from "@/config/site";

const COPYRIGHT_YEAR = process.env.NEXT_PUBLIC_BUILD_YEAR ?? String(new Date().getFullYear());

const FOOTER_SECTIONS = [
  {
    title: "Workspace",
    links: [
      { label: "AI chat", href: "/chat" },
      { label: "Coding assistant", href: "/code" },
      { label: "Documents", href: "/documents" },
      { label: "Data analytics", href: "/analytics" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Sign in", href: "/login" },
      { label: "Create account", href: "/signup" },
      { label: "Settings", href: "/settings" },
      { label: "Profile", href: "/profile" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-border/70 bg-muted/25">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-6 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="space-y-3">
          <Link href="/" className="inline-flex items-center gap-2.5" aria-label={`${siteConfig.name} home`}>
            <NexaMark className="size-8" />
            <span className="text-sm font-semibold tracking-tight">{siteConfig.name}</span>
          </Link>
          <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
            {siteConfig.tagline}. Built on a production Next.js, FastAPI and PostgreSQL
            foundation.
          </p>
          <p className="font-mono text-[11px] text-muted-foreground">v{siteConfig.version}</p>
        </div>

        {FOOTER_SECTIONS.map((section) => (
          <nav key={section.title} aria-label={section.title} className="space-y-3">
            <p className="text-xs font-semibold text-foreground">{section.title}</p>
            <ul className="space-y-2">
              {section.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}

        <nav aria-label="Resources" className="space-y-3">
          <p className="text-xs font-semibold text-foreground">Resources</p>
          <ul className="space-y-2">
            <li>
              <Link
                href={siteConfig.githubUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                GitHub repository
              </Link>
            </li>
            <li>
              <Link
                href={siteConfig.apiDocsUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                OpenAPI reference
              </Link>
            </li>
            <li>
              <Link
                href="/api/health"
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Service health
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-border/70">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-6 py-5 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {COPYRIGHT_YEAR} Nexa AI. All rights reserved.</p>
          <p>Conversations stay in your browser. Provider keys stay on the server.</p>
        </div>
      </div>
    </footer>
  );
}
