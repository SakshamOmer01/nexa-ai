"use client";

import { Menu, Plus, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { NexaWordmark } from "@/components/brand/nexa-mark";
import { Sidebar } from "@/components/workspace/sidebar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWorkspace } from "@/lib/workspace/provider";

const PAGE_TITLES: Record<string, string> = {
  "/chat": "AI Chat",
  "/code": "Coding Assistant",
  "/documents": "Documents",
  "/analytics": "Data Analytics",
  "/settings": "Settings",
  "/profile": "Profile",
};

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { notice, dismissNotice, selectConversation } = useWorkspace();
  const title = PAGE_TITLES[pathname] ?? "Workspace";

  return (
    <div className="min-h-dvh bg-background">
      <a
        href="#workspace-main"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to workspace content
      </a>

      <aside
        className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-sidebar-border lg:block"
        aria-label="Workspace sidebar"
      >
        <Sidebar />
      </aside>

      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent
          showCloseButton={false}
          className="top-0 left-0 h-dvh w-[86vw] max-w-xs translate-x-0 translate-y-0 gap-0 rounded-none border-y-0 border-l-0 p-0"
        >
          <DialogTitle className="sr-only">Navigation</DialogTitle>
          <DialogDescription className="sr-only">
            Conversations, workspace pages and account controls.
          </DialogDescription>
          <DialogClose asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute top-3.5 right-3 z-10"
              aria-label="Close navigation"
            >
              <X aria-hidden />
            </Button>
          </DialogClose>
          <Sidebar onNavigate={() => setMobileOpen(false)} />
        </DialogContent>
      </Dialog>

      <div className="flex min-h-dvh flex-col lg:pl-72">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-2 border-b border-border/70 bg-background/90 px-3 backdrop-blur-xl lg:hidden">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu aria-hidden />
            </Button>
            <Link href="/" aria-label="Nexa AI home" className="rounded-lg">
              <NexaWordmark />
            </Link>
          </div>
          <div className="flex items-center gap-1">
            <span className="mr-1 hidden text-xs font-medium text-muted-foreground sm:inline">
              {title}
            </span>
            <Button variant="ghost" size="icon-sm" asChild aria-label="Start a new chat">
              <Link
                href="/chat"
                onClick={() => {
                  selectConversation(null);
                }}
              >
                <Plus aria-hidden />
              </Link>
            </Button>
          </div>
        </header>

        {notice ? (
          <div
            role="status"
            className="flex items-start justify-between gap-3 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-700 dark:text-amber-300"
          >
            <p>{notice}</p>
            <button
              type="button"
              onClick={dismissNotice}
              className="rounded p-0.5 hover:bg-amber-500/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              aria-label="Dismiss storage notice"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
        ) : null}

        <main id="workspace-main" className="flex min-h-0 flex-1 flex-col">
          {children}
        </main>
      </div>
    </div>
  );
}
