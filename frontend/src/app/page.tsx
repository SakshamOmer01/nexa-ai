import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Architecture } from "@/components/sections/architecture";
import { Capabilities } from "@/components/sections/capabilities";
import { CtaSection } from "@/components/sections/cta";
import { Hero } from "@/components/sections/hero";
import { Stack } from "@/components/sections/stack";
import { StatusSection } from "@/components/sections/status";
import { Trust } from "@/components/sections/trust";
import { Workflow } from "@/components/sections/workflow";

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Workflow />
        <Capabilities />
        <Trust />
        <Stack />
        <Architecture />
        <StatusSection />
        <CtaSection />
      </main>
      <SiteFooter />
    </div>
  );
}
