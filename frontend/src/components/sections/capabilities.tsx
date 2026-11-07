import {
  ArrowUpRight,
  BarChart3,
  Code2,
  FileText,
  MessagesSquare,
  Mic,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

interface Capability {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  linkLabel: string;
}

const CAPABILITIES: Capability[] = [
  {
    icon: MessagesSquare,
    title: "A chat that keeps up",
    description:
      "Markdown answers, highlighted code, copy and regenerate, model choice and a searchable history that stays in your browser.",
    href: "/chat",
    linkLabel: "Open chat",
  },
  {
    icon: Code2,
    title: "Coding mode",
    description:
      "A focused workspace for implementation questions, with code-first answers, language-labelled blocks and starter prompts.",
    href: "/code",
    linkLabel: "Open coding assistant",
  },
  {
    icon: FileText,
    title: "Documents as context",
    description:
      "Upload text, Markdown, CSV, JSON or source files once, then attach them to any message. Nexa reads them without leaving your device.",
    href: "/documents",
    linkLabel: "Open documents",
  },
  {
    icon: BarChart3,
    title: "Analytics you can trust",
    description:
      "Conversation volume, model usage, activity by day and document counts — measured from your real workspace, never demo data.",
    href: "/analytics",
    linkLabel: "Open analytics",
  },
  {
    icon: Mic,
    title: "Voice and attachments",
    description:
      "Dictate a prompt with the browser's speech engine, attach a file, choose a model and send — all from one composer.",
    href: "/chat",
    linkLabel: "Try the composer",
  },
  {
    icon: ShieldCheck,
    title: "Yours by default",
    description:
      "Session tokens live in httpOnly cookies, provider keys never reach the browser, and history can be exported or erased in two clicks.",
    href: "/settings",
    linkLabel: "Review controls",
  },
];

export function Capabilities() {
  return (
    <section id="capabilities" className="scroll-mt-20 border-y border-border/60 bg-muted/25">
      <div className="mx-auto w-full max-w-7xl px-6 py-20">
        <div className="mx-auto max-w-2xl space-y-3 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
            Capabilities
          </p>
          <h2 className="text-balance text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
            Everything in one place, nothing in the way
          </h2>
          <p className="text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
            Each part of Nexa shares the same history, settings and design language, so moving from
            a question to a document to a chart never feels like changing products.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((capability) => (
            <Link
              key={`${capability.title}-${capability.href}`}
              href={capability.href}
              className="group relative flex flex-col gap-4 rounded-2xl border border-border/70 bg-background p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-linear-to-br from-brand-blue/15 to-brand-violet/15 text-primary ring-1 ring-primary/10">
                <capability.icon className="size-4.5" aria-hidden />
              </span>
              <div className="space-y-1.5">
                <h3 className="text-sm font-semibold tracking-tight">{capability.title}</h3>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {capability.description}
                </p>
              </div>
              <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-primary">
                {capability.linkLabel}
                <ArrowUpRight
                  className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  aria-hidden
                />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
