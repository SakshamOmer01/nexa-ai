import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export function CtaSection() {
  return (
    <section className="mx-auto w-full max-w-7xl px-6 py-20">
      <div className="relative overflow-hidden rounded-3xl border border-primary/15 bg-aurora px-6 py-14 text-center shadow-glow sm:px-12">
        <div
          className="bg-grid pointer-events-none absolute inset-0 opacity-30 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
          aria-hidden
        />
        <div className="relative mx-auto max-w-2xl space-y-5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-background/80 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="size-3.5" aria-hidden />
            Your first answer is one signup away
          </span>
          <h2 className="text-balance text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
            Make room for the work that matters
          </h2>
          <p className="text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
            Bring a question, a document or a stubborn bug. Nexa keeps the thread, the context and
            the details where you can find them again.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <Button size="lg" asChild className="h-11 rounded-full px-6 shadow-glow">
              <Link href="/signup">
                Create free account
                <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              className="h-11 rounded-full bg-background/80 px-6"
            >
              <Link href="/login">I already have an account</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
