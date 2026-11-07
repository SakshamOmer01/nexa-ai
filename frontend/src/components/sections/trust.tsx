import { ArrowUpRight, Cookie, HardDrive, KeyRound, Server } from "lucide-react";
import Link from "next/link";

import { siteConfig } from "@/config/site";

const FACTS = [
  {
    icon: Cookie,
    title: "Sessions in httpOnly cookies",
    description:
      "Access and refresh tokens are never readable by browser JavaScript. The proxy rotates an expired access cookie before a page renders.",
  },
  {
    icon: KeyRound,
    title: "Provider keys stay server-side",
    description:
      "The AI request is made by a same-origin route handler. Only an allowlisted model id reaches the browser, never the key.",
  },
  {
    icon: HardDrive,
    title: "History on your device",
    description:
      "Conversations, documents and preferences live in this browser's local storage, scoped to your account. Export or erase them at any time.",
  },
  {
    icon: Server,
    title: "A verifiable backend",
    description:
      "FastAPI and PostgreSQL sit behind every account action, with liveness and dependency-aware readiness probes you can inspect.",
  },
];

export function Trust() {
  return (
    <section className="border-y border-border/60 bg-foreground text-background">
      <div className="mx-auto w-full max-w-7xl px-6 py-20">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="space-y-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-background/60">
              Privacy &amp; security
            </p>
            <h2 className="text-balance text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
              Your work is not the product
            </h2>
            <p className="max-w-md text-pretty text-sm leading-relaxed text-background/70">
              Nexa ships no third-party analytics script and no advertising pixels. The data model
              is deliberately simple so you can audit it: accounts in PostgreSQL, conversations in
              your browser, model calls proxied by the server.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Link
                href={siteConfig.githubUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-background/20 px-4 py-2 text-xs font-medium transition-colors hover:bg-background/10"
              >
                Read the source
                <ArrowUpRight className="size-3.5" aria-hidden />
              </Link>
              <Link
                href={siteConfig.apiDocsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-background/20 px-4 py-2 text-xs font-medium transition-colors hover:bg-background/10"
              >
                Review the API
                <ArrowUpRight className="size-3.5" aria-hidden />
              </Link>
            </div>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2">
            {FACTS.map((fact) => (
              <li
                key={fact.title}
                className="rounded-2xl border border-background/15 bg-background/[0.06] p-4"
              >
                <fact.icon className="size-4 text-background/80" aria-hidden />
                <h3 className="mt-3 text-sm font-semibold">{fact.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-background/65">
                  {fact.description}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
