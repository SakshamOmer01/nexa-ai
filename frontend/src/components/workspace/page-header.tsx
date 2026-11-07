import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface PageHeaderProps {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}

export function PageHeader({ icon: Icon, eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-border/60 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2.5">
        <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
          <span className="flex size-6 items-center justify-center rounded-md bg-primary/10">
            <Icon className="size-3.5" aria-hidden />
          </span>
          {eyebrow}
        </p>
        <h1 className="text-balance text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
          {title}
        </h1>
        <p className="max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
