import { Check, CircleDashed } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { conventions, repoLayout, roadmap } from "@/config/site";

export function Architecture() {
  return (
    <section id="architecture" className="scroll-mt-20 border-y border-border/60 bg-muted/20">
      <div className="mx-auto w-full max-w-6xl px-6 py-20">
        <div id="layout" className="grid scroll-mt-20 gap-10 lg:grid-cols-2 lg:gap-14">
          <div className="space-y-6">
            <div className="space-y-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
                Architecture
              </p>
              <h2 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
                A layout that scales past the first feature
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                The monorepo separates deployables (<code className="font-mono text-xs">frontend</code>,{" "}
                <code className="font-mono text-xs">backend</code>) from the ML workspace, cross-service
                tests and operational scripts. Adding a feature touches one layer at a time.
              </p>
            </div>

            <ul className="space-y-3">
              {conventions.map((convention) => (
                <li key={convention} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Check className="size-3" aria-hidden />
                  </span>
                  <span className="leading-relaxed">{convention}</span>
                </li>
              ))}
            </ul>
          </div>

          <Card className="border-border/70 bg-background/60">
            <CardHeader className="border-b border-border/60">
              <CardTitle className="font-mono text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Repository layout
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-0.5 pt-3">
              {repoLayout.map((entry, index) => (
                <div key={entry.path}>
                  {index === repoLayout.length - 1 ? <Separator className="my-2" /> : null}
                  <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-baseline sm:gap-4">
                    <code className="min-w-[9.5rem] font-mono text-xs text-foreground">{entry.path}</code>
                    <span className="text-xs leading-relaxed text-muted-foreground">
                      {entry.description}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="mt-16">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
              Roadmap
            </p>
            <p className="text-[11px] text-muted-foreground">
              Shipped milestones and what comes next
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {roadmap.map((item) => (
              <div
                key={item.label}
                className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/40 px-4 py-3.5"
              >
                {item.status === "shipped" ? (
                  <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-400" aria-hidden />
                ) : (
                  <CircleDashed
                    className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                )}
                <p
                  className={
                    item.status === "shipped"
                      ? "text-xs leading-relaxed text-foreground"
                      : "text-xs leading-relaxed text-muted-foreground"
                  }
                >
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
