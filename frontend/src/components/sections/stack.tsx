import { Boxes, Database, Layers, Server, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { platformStack, type StackIcon } from "@/config/site";

const ICONS: Record<StackIcon, LucideIcon> = {
  layers: Layers,
  server: Server,
  database: Database,
  boxes: Boxes,
};

export function Stack() {
  return (
    <section id="stack" className="mx-auto w-full max-w-6xl scroll-mt-20 px-6 py-20">
      <div className="max-w-2xl space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">Platform</p>
        <h2 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
          One repository, four clean boundaries
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
          Each layer owns its contracts and can be built, tested and deployed independently. The
          boundaries are enforced by directory structure, typed schemas and CI jobs.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {platformStack.map((item) => {
          const Icon = ICONS[item.icon];
          return (
            <Card
              key={item.title}
              className="group border-border/70 bg-card/50 transition-colors hover:border-primary/40 hover:bg-card/80"
            >
              <CardHeader>
                <span className="mb-2 flex size-9 items-center justify-center rounded-lg border border-border/70 bg-background/60 text-primary">
                  <Icon className="size-4" aria-hidden />
                </span>
                <CardTitle className="text-base">{item.title}</CardTitle>
                <CardDescription className="leading-relaxed">{item.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-wrap gap-1.5">
                  {item.tags.map((tag) => (
                    <li key={tag}>
                      <Badge variant="secondary" className="font-mono text-[10px] font-normal">
                        {tag}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
