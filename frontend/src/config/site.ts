import { apiOrigin, env } from "@/lib/env";

export const siteConfig = {
  name: env.NEXT_PUBLIC_APP_NAME,
  version: env.NEXT_PUBLIC_APP_VERSION,
  url: env.NEXT_PUBLIC_SITE_URL,
  tagline: "The foundation for production AI products",
  description:
    "Nexa AI is a modular monorepo for shipping AI products: a Next.js application layer, a typed FastAPI backend, PostgreSQL persistence, an ML workspace, and CI/CD that verifies every layer.",
  githubUrl: "https://github.com/SakshamOmer01/nexa-ai",
  apiDocsUrl: `${apiOrigin}/docs`,
  nav: [
    { label: "Architecture", href: "#architecture" },
    { label: "Stack", href: "#stack" },
    { label: "Layout", href: "#layout" },
    { label: "Status", href: "#status" },
  ],
} as const;

export type StackIcon = "layers" | "server" | "database" | "boxes";

export interface StackItem {
  icon: StackIcon;
  title: string;
  description: string;
  tags: string[];
}

export const platformStack: StackItem[] = [
  {
    icon: "layers",
    title: "Application layer",
    description:
      "Next.js App Router with a typed, server-first data boundary. shadcn/ui primitives keep the design system consistent while Tailwind tokens drive theming.",
    tags: ["Next.js 16", "TypeScript", "Tailwind v4", "shadcn/ui"],
  },
  {
    icon: "server",
    title: "Service layer",
    description:
      "FastAPI with a versioned API surface, typed request/response contracts, structured JSON logging and correlation ids on every request.",
    tags: ["FastAPI", "Pydantic v2", "OpenAPI", "Async"],
  },
  {
    icon: "database",
    title: "Persistence layer",
    description:
      "SQLAlchemy 2.0 async models over PostgreSQL, with Alembic migrations, deterministic constraint names and pool tuning through the environment.",
    tags: ["PostgreSQL 17", "SQLAlchemy 2.0", "Alembic", "asyncpg"],
  },
  {
    icon: "boxes",
    title: "Delivery layer",
    description:
      "Multi-stage, non-root Docker images for both services, a single-command local stack, and GitHub Actions gates for lint, tests and builds.",
    tags: ["Docker Compose", "GitHub Actions", "Health probes"],
  },
];

export const repoLayout: Array<{ path: string; description: string; depth?: number }> = [
  { path: "frontend/", description: "Next.js app, UI system, typed API client" },
  { path: "backend/", description: "FastAPI service, models, migrations, tests" },
  { path: "ml/", description: "Training & inference workspace (pipeline contracts)" },
  { path: "docs/", description: "Architecture, development and ADRs" },
  { path: "scripts/", description: "Bootstrap, dev and verification helpers" },
  { path: "tests/", description: "Cross-service integration checks" },
  { path: ".github/workflows/", description: "CI: lint, tests, builds, containers" },
];

export const conventions: string[] = [
  "Typed contracts at every boundary — Pydantic on the server, TypeScript types on the client.",
  "Configuration is environment-driven and validated at start-up; insecure defaults fail fast in production.",
  "Two probes per service: cheap liveness, dependency-aware readiness.",
  "Lint, typecheck and tests are the same locally and in CI via scripts/verify.sh.",
];

export interface RoadmapItem {
  label: string;
  status: "shipped" | "next";
}

export const roadmap: RoadmapItem[] = [
  {
    label: "Foundation: typed web app, async API, PostgreSQL, Docker and CI",
    status: "shipped",
  },
  {
    label: "Accounts, JWT access tokens and rotating refresh-token sessions",
    status: "shipped",
  },
  {
    label: "Multi-tenant workspaces, per-device session management and login rate limiting",
    status: "next",
  },
  { label: "Model registry and inference workers in the ML workspace", status: "next" },
  { label: "Observability: OpenTelemetry traces, metrics and error reporting", status: "next" },
  { label: "Background jobs and evaluation pipelines for model quality gates", status: "next" },
];
