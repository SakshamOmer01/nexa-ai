import { ArrowRight, Check, ChevronDown, GitBranch, Sparkles, TypeIcon } from "lucide-react";
import Link from "next/link";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

/**
 * Landing page. Sections mirror (and slightly expand) the existing brand sections in
 * src/components/sections so the two surfaces reinforce each other instead of duplicating
 * their copy. The header and footer are the site chrome: they stay the same, the page body is
 * the new premium surface.
 */

const PROOF_ITEMS = [
  { text: "Sign up in thirty seconds, no credit card", icon: Check },
  { text: "Search every conversation by title or message", icon: Check },
  { text: "Attach a document from your library in one tap", icon: Check },
  { text: "Copy, regenerate or continue any answer", icon: Check },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-20 pb-16 sm:pt-24 sm:pb-20">
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-brand-violet/5 via-transparent to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-grid opacity-30 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]"
        aria-hidden
      />
      <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-6 py-16 lg:grid-cols-[1.04fr_0.96fr] lg:gap-16 lg:py-20">
        <div className="space-y-7">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-violet/20 bg-background/80 px-3.5 py-1.5 text-xs font-medium text-brand-violet shadow-xs backdrop-blur">
            <Sparkles className="size-3.5" aria-hidden />
            New · Documents, analytics and coding mode
          </span>

          <div className="space-y-5">
            <h1 className="text-balance text-4xl leading-[1.06] font-semibold tracking-[-0.03em] sm:text-5xl xl:text-[3.4rem]">
              Nexa brings your{" "}
              <span className="text-gradient">asking, writing and building</span> into one calm
              workspace.
            </h1>
            <p className="max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
              A private AI workspace where chat, documents, usage analytics and a focused coding
              assistant share one history, one design language and one set of controls.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" asChild className="h-11 rounded-full px-6 shadow-glow">
              <a href="#product">Create free account <ArrowRight className="size-4" aria-hidden /></a>
            </Button>
            <Button
              variant="outline"
              size="lg"
              asChild
              className="h-11 rounded-full border-border bg-background/80 px-6"
            >
              <a href="#product">
                Try the assistant <ChevronDown className="size-4" aria-hidden />
              </a>
            </Button>
            <Button variant="ghost" size="lg" asChild className="h-11 rounded-full px-4">
              <a href={siteConfig.githubUrl} target="_blank" rel="noreferrer">
                <GitBranch aria-hidden />
                <span className="hidden sm:inline">View source</span>
              </a>
            </Button>
          </div>

          <ul className="flex flex-wrap gap-x-6 gap-y-2.5">
            {PROOF_ITEMS.map((item) => (
              <li key={item.text} className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <item.icon className="size-3" aria-hidden />
                </span>
                {item.text}
              </li>
            ))}
          </ul>
        </div>

        <div className="animate-fade-up lg:pl-4">
          <ProductPreview />
        </div>
      </div>
    </section>
  );
}

const SIDEBAR_ITEMS = [
  { icon: TypeIcon, label: "New chat", active: true },
  { icon: Search, label: "Search conversations" },
  { icon: ShieldCheck, label: "Documents" },
  { icon: ChartBar3, label: "Analytics" },
  { icon: Code2, label: "Coding mode" },
];

const PLATFORM_FEATURES = [
  {
    icon: Check,
    title: "Real, not simulated",
    description:
      "Baseline cards render a live health probe, and everything else is soil through the API. There are no demo threads, no placeholder answers, nothing you can stub out by inspection.",
  },
  {
    icon: Check,
    title: "Production behind the scenes",
    description:
      "Next.js 16 + App Router, FastAPI, PostgreSQL, Alembic migrations, ruff lint and format, strict TypeScript, and a five-job GitHub Actions pipeline.",
  },
  {
    icon: Check,
    title: "Built for the way you work",
    description:
      "One workspace for questions, documents, charts and code. Rename threads, search history, attach files, and export everything as JSON.",
  },
];

const CAPABILITY = [
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
    icon: ShieldCheck,
    title: "Documents as context",
    description:
      "Upload text, Markdown, CSV, JSON or source files once, then attach them to any message. Nothing leaves your device.",
    href: "/documents",
    linkLabel: "Open documents",
  },
  {
    icon: ChartBar3,
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
      "Dictate a prompt with the browser's speech engine, attach a file, choose a model and send from one composer.",
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

function ChartArea({ day }: { day: { date: string; label: string; messages: number } }) {
  return (
    <div key={day.date} className="relative flex flex-1 flex-col justify-end">
      <div
        className={`absolute inset-x-0 -bottom-1 rounded-[calc(var(--radius)*0.35)] bg-linear-to-t from-brand-violet/80 to-brand-blue/80 transition-all duration-500 sm:left-0 sm:w-full ${
          day.messages === 0 ? "from-muted" : "group-hover:from-brand-violet group-hover:to-brand-blue"
        }`}
        style={{ height: `${Math.max(4, (day.messages / 6) * 100)}%` }}
        role="img"
        aria-label={`${day.label}: ${day.messages} messages`}
      />
      <span className="sr-only">{day.label}: {day.messages} messages</span>
    </div>
  );
}

function Chart() {
  const days = [
    { date: "2026-11-05", label: "Thu", messages: 2 },
    { date: "2026-11-06", label: "Fri", messages: 5 },
    { date: "2026-11-07", label: "Sat", messages: 3 },
  ];
  return (
    <div className="relative">
      <div className="flex h-64 items-end gap-2" role="img" aria-label="Messages per day bar chart">
        {days.map((day) => (
          <ChartArea key={day.date} day={day} />
        ))}
      </div>
      <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
        <span>{days[0]?.label}</span>
        <span>{days[days.length - 1]?.label}</span>
      </div>
    </div>
  );
}

function SparkBar() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card p-4">
        <div className="relative flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Code2 className="size-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-sm font-semibold">Try the coding assistant</p>
          <p className="truncate text-xs text-muted-foreground">
            Paste a stack trace or a function, and get a tested, language-labelled answer.
          </p>
        </div>
        <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      </div>
      <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card p-4">
        <div className="relative flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FileText className="size-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-sm font-semibold">Bring your own context</p>
          <p className="truncate text-xs text-muted-foreground">
            Upload a document once, then attach it to any question in one tap.
          </p>
        </div>
        <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      </div>
      <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card p-4">
        <div className="relative flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <BarChart3 className="size-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-sm font-semibold">Measure what matters</p>
          <p className="truncate text-xs text-muted-foreground">
            Conversation volume, model usage and documents, computed from your real workspace.
          </p>
        </div>
        <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      </div>
      <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card p-4">
        <div className="relative flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Mic className="size-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-sm font-semibold">Dictate, don&apos;t type</p>
          <p className="truncate text-xs text-muted-foreground">
            Use the browser&apos;s voice input to speak a prompt and send it instantly.
          </p>
        </div>
        <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      </div>
    </div>
  );
}

function PlatformRow({
  icon: Icon,
  title,
  description,
  tags,
}: Readonly<{
  icon: (typeof CAPABILITY)[number]["icon"];
  title: string;
  description: string;
  tags: string[];
}>) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
      <div
        className="absolute inset-0 bg-gradient-to-br from-brand-blue/5 via-transparent to-brand-violet/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        aria-hidden
      />
      <div className="relative p-5">
        <span className="inline-flex size-11 items-center justify-center rounded-xl bg-linear-to-br from-brand-blue/15 to-brand-violet/15 text-primary ring-1 ring-primary/10">
          <Icon className="size-4.5" aria-hidden />
        </span>
        <h3 className="mt-4 text-base font-semibold tracking-tight">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-muted/40 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Platform() {
  return (
    <section id="stack" className="scroll-mt-20 py-20 sm:py-24">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
            Platform
          </span>
          <h2 className="text-balance text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
            One repository, four clean boundaries
          </h2>
          <p className="max-w-xl text-pretty text-base leading-relaxed text-muted-foreground">
            Each layer owns its contracts and can be built, tested and deployed independently.
            The boundaries are enforced by directory structure, typed schemas and CI jobs.
          </p>

          <div className="grid gap-4 sm:grid-cols-3">
            {PLATFORM_FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <feature.icon className="size-4" aria-hidden />
                </span>
                <h3 className="text-sm font-semibold tracking-tight">{feature.title}</h3>
                <p className="text-xs leading-relaxed text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button variant="outline" asChild>
              <a href="/docs">
                Read the architecture docs
                <ArrowRight className="size-4" aria-hidden />
              </a>
            </Button>
            <Button variant="ghost" asChild>
              <a href={siteConfig.githubUrl} target="_blank" rel="noreferrer">
                <GitBranch className="size-4" aria-hidden />
                View source
              </a>
            </Button>
          </div>
        </div>

        <div className="relative hidden shrink-0 lg:block">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand-blue/10 via-primary/5 to-brand-violet/10 blur-3xl" aria-hidden />
          <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card p-6">
            <div className="flex items-center gap-2 border-b border-border/70 px-3 py-2">
              <span className="size-2 rounded-full bg-[oklch(0.72_0.17_25)]" aria-hidden />
              <span className="size-2 rounded-full bg-[oklch(0.8_0.14_85)]" aria-hidden />
              <span className="size-2 rounded-full bg-[oklch(0.75_0.15_150)]" aria-hidden />
              <span className="ml-3 rounded-md bg-background/80 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                nexa.ai / platform
              </span>
            </div>
            <div className="mt-4 grid gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-muted-foreground">frontend/</span>
                <span className="rounded bg-emerald-500/10 px-2 py-0.5 font-mono text-xs text-emerald-700">
                  Next.js + React + TS
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-muted-foreground">backend/</span>
                <span className="rounded bg-emerald-500/10 px-2 py-0.5 font-mono text-xs text-emerald-700">
                  FastAPI + PostgreSQL
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-muted-foreground">ml/</span>
                <span className="rounded bg-slate-500/10 px-2 py-0.5 font-mono text-xs text-slate-700">
                  Training &amp; inference
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-muted-foreground">docs/</span>
                <span className="rounded bg-slate-500/10 px-2 py-0.5 font-mono text-xs text-slate-700">
                  Architecture, guides
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-muted-foreground">.github/</span>
                <span className="rounded bg-slate-500/10 px-2 py-0.5 font-mono text-xs text-slate-700">
                  CI: lint, tests, builds
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Features() {
  return (
    <section id="product" className="scroll-mt-20 border-y border-border/60 bg-muted/10">
      <div className="mx-auto max-w-7xl px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
            Capabilities
          </span>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
            Everything you need, nothing you don&apos;t
          </h2>
          <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            One workspace for questions, documents, charts and code. The same history, settings and
            design language carry through every surface.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITY.map((item) => (
            <Link
              key={`${item.title}-${item.href}`}
              href={item.href}
              className="group flex flex-col gap-4 rounded-2xl border border-border/70 bg-background p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
            >
              <span className="inline-flex size-11 items-center justify-center rounded-xl bg-linear-to-br from-brand-blue/15 to-brand-violet/15 text-primary ring-1 ring-primary/10">
                <item.icon className="size-4.5" aria-hidden />
              </span>
              <div className="space-y-1.5">
                <h3 className="text-sm font-semibold tracking-tight">{item.title}</h3>
                <p className="text-xs leading-relaxed text-muted-foreground">{item.description}</p>
              </div>
              <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-primary">
                {item.linkLabel}
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PlatformStack() {
  return (
    <section id="stack" className="scroll-mt-20 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
              Platform
            </span>
            <h2 className="text-balance text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
              Built on a stack that scales past the first feature
            </h2>
            <p className="max-w-xl text-pretty text-base leading-relaxed text-muted-foreground">
              Next.js 16, FastAPI and PostgreSQL — each layer owns its contract, and every commit
              runs the same lint, typecheck and test gates in CI.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
            {PLATFORM_FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <feature.icon className="size-4" aria-hidden />
                </span>
                <h3 className="text-sm font-semibold tracking-tight">{feature.title}</h3>
                <p className="text-xs leading-relaxed text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function CallToAction() {
  return (
    <section className="py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="relative overflow-hidden rounded-3xl border border-primary/15 bg-aurora px-6 py-14 text-center sm:px-12">
          <div
            className="pointer-events-none absolute inset-0 bg-grid opacity-30 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
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
            <p className="max-w-lg text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
              Bring a question, a document or a stubborn bug. Nexa keeps the thread, the context and
              the details where you can find them again.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <Button size="lg" asChild className="h-11 rounded-full px-6 shadow-glow">
                <a href="/signup">
                  Create free account
                  <ArrowRight className="size-4" aria-hidden />
                </a>
              </Button>
              <Button variant="outline" size="lg" asChild className="h-11 rounded-full bg-background/80 px-6">
                <a href="/login">I already have an account</a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

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
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] ${item.active ? "bg-background font-medium text-foreground shadow-xs ring-1 ring-border/70" : "text-muted-foreground"}`}
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
              <p className="px-1 pb-2 text-[11px] text-muted-foreground/80">Ask Nexa anything…</p>
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
