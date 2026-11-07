"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { NexaMark } from "@/components/brand/nexa-mark";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { siteConfig } from "@/config/site";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="md:hidden"
          aria-label="Open navigation"
        >
          <Menu aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent className="top-4 translate-y-0 gap-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <NexaMark className="size-7" />
            {siteConfig.name}
          </DialogTitle>
          <DialogDescription>Jump to a section or open your workspace.</DialogDescription>
        </DialogHeader>
        <nav aria-label="Mobile" className="grid gap-1">
          {siteConfig.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="grid gap-2 border-t border-border pt-4">
          <Button variant="outline" asChild>
            <Link href="/login" onClick={() => setOpen(false)}>
              Sign in
            </Link>
          </Button>
          <Button asChild>
            <Link href="/signup" onClick={() => setOpen(false)}>
              Create free account
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
