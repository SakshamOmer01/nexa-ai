"use client";

import { MobileNav } from "@/components/layout/mobile-nav";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export function SiteHeaderMobileActions() {
  return (
    <div className="flex items-center gap-0.5">
      <ThemeToggle />
      <MobileNav />
    </div>
  );
}
