import { ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent } from "@/components/ui/card";

interface AuthShellProps {
  title: string;
  description: string;
  footer: ReactNode;
  children: ReactNode;
}

/** Shared frame for the sign-in and sign-up pages. */
export function AuthShell({ title, description, footer, children }: AuthShellProps) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-16">
        <div
          className="bg-grid pointer-events-none absolute inset-0 opacity-20 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]"
          aria-hidden
        />
        <div className="relative w-full max-w-md space-y-6">
          <div className="space-y-3 text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5 text-primary" aria-hidden />
              Secure accounts
            </span>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
            <p className="text-balance text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>

          <Card className="border-border/70 bg-card/70 shadow-2xl shadow-black/20 backdrop-blur">
            <CardContent className="pt-2">{children}</CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground">{footer}</p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
