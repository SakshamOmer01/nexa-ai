import { BarChart3, Code2, FileText, History, Mic, Paperclip, Search, Sparkles } from "lucide-react";

import { NexaMark } from "@/components/brand/nexa-mark";

const SIDEBAR_ITEMS = [
  { icon: History, label: "New chat", active: true },
  { icon: Search, label: "Search conversations" },
  { icon: FileText, label: "Documents" },
  { icon: BarChart3, label: "Analytics" },
  { icon: Code2, label: "Coding mode" },
];

/**
 * A static illustration of the workspace. It deliberately contains no fabricated conversation
 * or assistant answer; the caption tells assistive technology exactly what it is.
 */
export function ProductPreview() {
  return (
    <figure className="relative">
      <div
        className="pointer-events-none absolute -inset-8 rounded-[2.5rem] bg-linear-to-br from-brand-blue/20 via-primary/10 to-brand-violet/20 blur-3xl"
        aria-hidden
      />
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-background shadow-glow">
        <div className="flex items-center gap-2 border-b border-border/70 bg-muted/40 px-4 py-3">
          <span className="size-2 rounded-full bg-[oklch(0.72_0.17_25)]" aria-hidden />
          <span className="size-2 rounded-full bg-[oklch(0.8_0.14_85)]" aria-hidden />
          <span className="size-2 rounded-full bg-[oklch(0.75_0.15_150)]" aria-hidden />
          <span className="ml-3 rounded-md bg-background/80 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
            nexa.ai / chat
          </span>
        </div>

        <div className="grid grid-cols-[9.5rem_1fr] text-left sm:grid-cols-[11rem_1fr]">
          <div className="space-y-1 border-r border-border/70 bg-sidebar/80 p-3">
            <div className="mb-3 flex items-center gap-2 px-1">
              <NexaMark className="size-5" />
              <span className="text-xs font-semibold">Nexa AI</span>
            </div>
            {SIDEBAR_ITEMS.map((item) => (
              <div
                key={item.label}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] ${
                  item.active
                    ? "bg-background font-medium text-foreground shadow-xs ring-1 ring-border/70"
                    : "text-muted-foreground"
                }`}
              >
                <item.icon className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">{item.label}</span>
              </div>
            ))}
            <div className="mt-6 space-y-1.5 px-2">
              <div className="h-1.5 w-16 rounded-full bg-muted" />
              <div className="h-1.5 w-20 rounded-full bg-muted" />
              <div className="h-1.5 w-14 rounded-full bg-muted" />
            </div>
          </div>

          <div className="relative flex min-h-64 flex-col justify-between p-4 sm:min-h-72 sm:p-5">
            <div
              className="pointer-events-none absolute top-6 right-4 size-24 rounded-full bg-linear-to-br from-brand-blue/20 to-brand-violet/25 blur-2xl sm:size-32"
              aria-hidden
            />
            <div className="relative space-y-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[10px] font-medium text-primary">
                <Sparkles className="size-3" aria-hidden />
                Workspace ready
              </span>
              <p className="max-w-[18rem] text-sm font-semibold tracking-tight text-foreground sm:text-base">
                What should we work through today?
              </p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {["Ask about a document", "Debug a tricky function", "Summarise a dataset", "Draft a plan"].map(
                  (label) => (
                    <div
                      key={label}
                      className="rounded-lg border border-border/70 bg-card/80 px-2.5 py-2 text-[10px] text-muted-foreground shadow-xs"
                    >
                      {label}
                    </div>
                  ),
                )}
              </div>
            </div>

            <div className="relative mt-5 rounded-xl border border-border/80 bg-card p-2.5 shadow-sm">
              <p className="px-1 pb-2 text-[11px] text-muted-foreground/80">
                Ask Nexa anything…
              </p>
              <div className="flex items-center justify-between border-t border-border/60 pt-2">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Paperclip className="size-3.5" aria-hidden />
                  <Mic className="size-3.5" aria-hidden />
                  <span className="ml-1 rounded-full border border-border/70 px-2 py-0.5 text-[9px]">
                    Nexa 1 · Standard
                  </span>
                </div>
                <span className="rounded-md bg-primary px-2 py-1 text-[9px] font-medium text-primary-foreground">
                  Send
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-[11px] text-muted-foreground">
        An illustration of the Nexa workspace — chat, files, analytics and code in one place.
      </figcaption>
    </figure>
  );
}
