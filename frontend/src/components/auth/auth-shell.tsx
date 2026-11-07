import { Check, ShieldCheck, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import { NexaMark } from "@/components/brand/nexa-mark";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { siteConfig } from "@/config/site";

interface AuthShellProps {
  title: string;
  description: string;
  footer: ReactNode;
  children: ReactNode;
}

const BENEFITS = [
  "Chat, documents, analytics and code in one workspace",
  "History stored in your browser, scoped to your account",
  "No tracking scripts and no advertising pixels",
];

/** Shared frame for the sign-in and sign-up pages. */
export function AuthShell({ title, description, footer, children }: AuthShellProps) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-10 sm:px-6 sm:py-14">
        <div className="pointer-events-none absolute inset-0 bg-aurora opacity-60" aria-hidden />
        <div
          className="bg-grid pointer-events-none absolute inset-0 opacity-30 [mask-image:radial-gradient(ellipse_at_top,black,transparent_75%)]"
          aria-hidden
        />

        <div className="relative w-full max-w-5xl overflow-hidden rounded-3xl border border-border/80 bg-background shadow-glow lg:grid lg:grid-cols-[1fr_1.05fr]">
          <aside className="relative hidden flex-col justify-between overflow-hidden bg-linear-to-br from-brand-blue/10 via-background to-brand-violet/10 p-10 lg:flex">
            <div className="space-y-8">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background/80 px-3 py-1 text-xs font-medium text-primary">
                <ShieldCheck className="size-3.5" aria-hidden />
                Secure accounts
              </span>
              <div className="space-y-4">
                <NexaMark className="size-11" />
                <h2 className="text-balance text-3xl leading-tight font-semibold tracking-[-0.02em]">
                  A quieter place to think.
                </h2>
                <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                  {siteConfig.name} keeps the assistant, your files and the numbers behind your work
                  in one focused space.
                </p>
              </div>
              <ul className="space-y-3">
                {BENEFITS.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-2.5 text-xs text-muted-foreground">
                    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Check className="size-3" aria-hidden />
                    </span>
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Sparkles className="size-3.5 text-primary" aria-hidden />
              Original Nexa AI interface · v{siteConfig.version}
            </p>
          </aside>

          <div className="p-6 sm:p-10">
            <div className="mx-auto w-full max-w-sm space-y-6">
              <div className="space-y-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-primary lg:hidden">
                  <ShieldCheck className="size-3" aria-hidden />
                  Secure accounts
                </span>
                <h1 className="text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">{title}</h1>
                <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </div>

              <div>{children}</div>

              <p className="text-center text-xs text-muted-foreground">{footer}</p>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
