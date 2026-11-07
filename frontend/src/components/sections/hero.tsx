import { ArrowRight, Check, GitBranch, Sparkles } from "lucide-react";
import Link from "next/link";

import { ProductPreview } from "@/components/sections/product-preview";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

const PROOF = ["No credit card", "Local-first history", "Bring your own model"];

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 bg-aurora opacity-70"
        aria-hidden
      />
      <div
        className="bg-grid pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_top,black,transparent_72%)]"
        aria-hidden
      />

      <div className="relative mx-auto grid w-full max-w-7xl items-center gap-12 px-6 pt-14 pb-16 lg:grid-cols-[1.02fr_0.98fr] lg:gap-10 lg:pt-20 lg:pb-24">
        <div className="space-y-7">
          <span className="inline-flex animate-fade-up items-center gap-2 rounded-full border border-primary/20 bg-background/80 px-3 py-1.5 text-xs font-medium text-primary shadow-xs backdrop-blur">
            <Sparkles className="size-3.5" aria-hidden />
            New · Documents, analytics and coding mode
          </span>

          <div className="animate-fade-up animation-delay-100 space-y-5">
            <h1 className="text-balance text-4xl leading-[1.05] font-semibold tracking-[-0.03em] sm:text-5xl lg:text-[3.5rem]">
              One calm workspace for{" "}
              <span className="text-gradient">everything you ask AI.</span>
            </h1>
            <p className="max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
              {siteConfig.description}
            </p>
          </div>

          <div className="animate-fade-up animation-delay-200 flex flex-wrap items-center gap-3">
            <Button size="lg" asChild className="h-11 rounded-full px-6 shadow-glow">
              <Link href="/signup">
                Start for free
                <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              asChild
              className="h-11 rounded-full border-border bg-background/80 px-6"
            >
              <Link href="/chat">Open the assistant</Link>
            </Button>
            <Button variant="ghost" size="lg" asChild className="h-11 rounded-full px-4">
              <Link href={siteConfig.githubUrl} target="_blank" rel="noreferrer">
                <GitBranch aria-hidden />
                <span className="hidden sm:inline">View source</span>
              </Link>
            </Button>
          </div>

          <ul className="animate-fade-up animation-delay-300 flex flex-wrap gap-x-5 gap-y-2">
            {PROOF.map((item) => (
              <li key={item} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="flex size-4 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Check className="size-3" aria-hidden />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="animate-fade-up animation-delay-200 lg:pl-2">
          <ProductPreview />
        </div>
      </div>
    </section>
  );
}
