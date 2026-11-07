import { Activity, ExternalLink } from "lucide-react";
import Link from "next/link";

import { HealthStatusPanel } from "@/components/health-status-panel";
import { siteConfig } from "@/config/site";

export function StatusSection() {
  return (
    <section id="status" className="scroll-mt-20 border-t border-border/60">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[1fr_0.9fr] lg:items-center">
        <div className="space-y-4">
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
            <Activity className="size-3.5" aria-hidden />
            Live status
          </p>
          <h2 className="text-balance text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
            Boring infrastructure, on purpose
          </h2>
          <p className="max-w-lg text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
            This panel is not a screenshot. It calls the web app&apos;s health route, which in turn
            checks the FastAPI service and its PostgreSQL dependency on every refresh, so you can
            see exactly what is up.
          </p>
          <dl className="grid gap-3 text-xs sm:grid-cols-2">
            <div className="rounded-xl border border-border/70 bg-card p-3">
              <dt className="font-medium text-foreground">Readiness</dt>
              <dd className="mt-1 leading-relaxed text-muted-foreground">
                <code className="font-mono">/api/health</code> stays 200 while the web process
                serves, and reports degraded dependencies honestly.
              </dd>
            </div>
            <div className="rounded-xl border border-border/70 bg-card p-3">
              <dt className="font-medium text-foreground">Authentication</dt>
              <dd className="mt-1 leading-relaxed text-muted-foreground">
                Account and session flows are checked end to end in CI against the real API.
              </dd>
            </div>
          </dl>
          <Link
            href={siteConfig.apiDocsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            Inspect the API contracts
            <ExternalLink className="size-3.5" aria-hidden />
          </Link>
        </div>

        <HealthStatusPanel />
      </div>
    </section>
  );
}
