import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Hero, Platform, Features, CallToAction } from "./components";

export default function LandingPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Features />
        <Platform />
        <CallToAction />
      </main>
      <SiteFooter />
    </div>
  );
}
