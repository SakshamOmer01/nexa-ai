import { ArrowRight, GitBranch } from "lucide-react";
import Link from "next/link";

import { HealthStatusPanel } from "@/components/health-status-panel";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

const HIGHLIGHTS = ["Next.js 16", "FastAPI", "PostgreSQL 17", "Docker + CI"];

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border/60">
      <div
        className="bg-grid pointer-events-none absolute inset-0 opacity-30 [mask-image:radial-gradient(ellipse_at_top,black,transparent_72%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -top-56 left-1/2 size-[560px] -translate-x-1/2 rounded-full bg-primary/20 blur-[130px]"
        aria-hidden
      />

      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-14 px-6 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:py-28">
        <div className="space-y-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden />
            Monorepo foundation
            <span className="font-mono text-[11px] text-foreground/70">v{siteConfig.version}</span>
          </span>

          <div className="space-y-5">
            <h1 className="text-balance text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              Ship AI products on a foundation{" "}
              <span className="bg-linear-to-r from-primary via-primary to-fuchsia-400 bg-clip-text text-transparent">
                built for production.
              </span>
            </h1>
            <p className="max-w-xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg">
              {siteConfig.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" asChild className="h-10 px-5">
              <Link href={siteConfig.apiDocsUrl} target="_blank" rel="noreferrer">
                Explore the API
                <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild className="h-10 px-5">
              <Link href={siteConfig.githubUrl} target="_blank" rel="noreferrer">
                <GitBranch aria-hidden />
                Repository
              </Link>
            </Button>
          </div>

          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="size-1 rounded-full bg-primary/60" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative lg:pl-4">
          <div
            className="pointer-events-none absolute -inset-6 rounded-3xl bg-linear-to-br from-primary/15 via-transparent to-transparent blur-2xl"
            aria-hidden
          />
          <div className="relative">
            <HealthStatusPanel />
            <p className="mt-4 px-1 text-[11px] leading-relaxed text-muted-foreground">
              Probes: <code className="font-mono">/api/health</code> on this app and{" "}
              <code className="font-mono">/api/v1/health</code> on the API. Readiness fails with HTTP
              503 when PostgreSQL is unreachable.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
