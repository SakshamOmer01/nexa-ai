# Nexa AI — Frontend

Next.js 16 (App Router, React Server Components) application layer. See the root
[README](../README.md), [architecture](../docs/architecture.md) and
[development guide](../docs/development.md).

## Structure

| Path | Purpose |
| --- | --- |
| `src/app/` | Routes, root layout, `/login`, `/signup`, `/dashboard`, `/api/health`, `/api/auth/*` |
| `src/components/ui/` | shadcn/ui primitives (Radix-based) |
| `src/components/auth/` | Auth form, shell, signed-in nav state and sign-out button |
| `src/components/layout/` | Header and footer shells |
| `src/components/sections/` | Landing page sections |
| `src/config/site.ts` | Branding, navigation, stack and roadmap content |
| `src/lib/env.ts` | Validated public environment (zod) |
| `src/lib/api-client.ts` | Server-side API client with timeout + typed errors |
| `src/lib/auth/` | Same-origin BFF, cookie definitions and server session helpers |
| `src/proxy.ts` | Rotates a stale access cookie and guards `/dashboard` |
| `src/types/api.ts` | Wire contracts mirrored from the backend schemas |

## Local development

```bash
npm ci
cp .env.example .env.local     # optional; defaults work for local dev
npm run dev                    # http://localhost:3000
```

The app degrades gracefully when the API is not running: the page renders and the status panel
reports `backend-api: down`.

## Authentication

`/api/auth/signup`, `/api/auth/login` and `/api/auth/logout` are a same-origin BFF. They call the
API server-side and store the access and refresh tokens in **httpOnly, SameSite=Lax** cookies
(`Secure` when `NEXT_PUBLIC_SITE_URL` is https); only the public user is returned to the browser.
`src/proxy.ts` rotates an expired access cookie through `/api/v1/auth/refresh` before rendering, so
sessions survive access-token expiry, and `/dashboard` redirects to `/login` when no session exists.
See [ADR 0002](../docs/adr/0002-jwt-authentication.md) and
[ADR 0003](../docs/adr/0003-refresh-token-rotation.md) for the design and trade-offs.

## Quality gates

```bash
npm run lint
npm run typecheck   # next typegen && tsc --noEmit
npm run build       # production standalone build
```

> `output: "standalone"` is enabled for Docker. For a local production preview use the standalone
> server (`node .next/standalone/server.js`) or accept the warning from `next start`.
