import { CheckCircle2, Layers, MessageSquarePlus, ShieldCheck } from "lucide-react";

const STEPS = [
  {
    icon: MessageSquarePlus,
    title: "Create your account",
    description:
      "Email and password, hashed with Argon2id. Sessions are signed JWTs in httpOnly cookies and renew silently.",
  },
  {
    icon: Layers,
    title: "Pick your surface",
    description:
      "Chat for research and writing, coding mode for implementation, documents for context, analytics for what you actually use.",
  },
  {
    icon: ShieldCheck,
    title: "Keep what matters",
    description:
      "Rename and search threads, attach files, export everything as JSON, and clear your workspace whenever you want.",
  },
];

export function Workflow() {
  return (
    <section id="product" className="mx-auto w-full max-w-7xl scroll-mt-20 px-6 py-20">
      <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div className="space-y-4 lg:sticky lg:top-24">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
            How it works
          </p>
          <h2 className="text-balance text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
            From a blank page to a finished answer
          </h2>
          <p className="text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
            Nexa is built around one loop: ask, bring context, iterate. No onboarding maze, no
            feature you have to configure before your first question.
          </p>
          <ul className="space-y-2.5 pt-2">
            {[
              "Search every conversation by title or message",
              "Attach a document from your library in one tap",
              "Copy or regenerate any answer without losing the thread",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <ol className="space-y-3">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="group flex gap-4 rounded-2xl border border-border/70 bg-card p-5 transition-colors hover:border-primary/25"
            >
              <div className="flex flex-col items-center gap-2">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <step.icon className="size-4" aria-hidden />
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  0{index + 1}
                </span>
              </div>
              <div className="space-y-1.5 pt-0.5">
                <h3 className="text-sm font-semibold tracking-tight">{step.title}</h3>
                <p className="text-xs leading-relaxed text-muted-foreground">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
