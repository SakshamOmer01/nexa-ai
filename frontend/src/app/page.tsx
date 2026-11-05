import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Architecture } from "@/components/sections/architecture";
import { Hero } from "@/components/sections/hero";
import { Stack } from "@/components/sections/stack";

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main id="status" className="flex-1 scroll-mt-20">
        <Hero />
        <Stack />
        <Architecture />
      </main>
      <SiteFooter />
    </div>
  );
}
