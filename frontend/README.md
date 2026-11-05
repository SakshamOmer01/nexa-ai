# Nexa AI — Frontend

Next.js 16 (App Router, React Server Components) application layer. See the root
[README](../README.md), [architecture](../docs/architecture.md) and
[development guide](../docs/development.md).

## Structure

| Path | Purpose |
| --- | --- |
| `src/app/` | Routes, root layout, `/api/health` route handler |
| `src/components/ui/` | shadcn/ui primitives (Radix-based) |
| `src/components/layout/` | Header and footer shells |
| `src/components/sections/` | Landing page sections |
| `src/config/site.ts` | Branding, navigation and foundation content |
| `src/lib/env.ts` | Validated public environment (zod) |
| `src/lib/api-client.ts` | Server-side API client with timeout + typed errors |
| `src/types/api.ts` | Wire contracts mirrored from the backend schemas |

## Local development

```bash
npm ci
cp .env.example .env.local     # optional; defaults work for local dev
npm run dev                    # http://localhost:3000
```

The app degrades gracefully when the API is not running: the page renders and the status panel
reports `backend-api: down`.

## Quality gates

```bash
npm run lint
npm run typecheck   # next typegen && tsc --noEmit
npm run build       # production standalone build
```

> `output: "standalone"` is enabled for Docker. For a local production preview use the standalone
> server (`node .next/standalone/server.js`) or accept the warning from `next start`.
