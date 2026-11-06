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
| `e2e/` | Playwright browser flows against the running stack |

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
npm run typecheck        # next typegen && tsc --noEmit
npm test -- --coverage   # Vitest + Testing Library, 95% coverage floor
npm run build            # production standalone build

# Browser E2E: start the stack first (./scripts/dev.sh or docker compose up -d)
npx playwright install chromium
npm run test:e2e
```

Tests sit next to the code they cover (`src/**/*.test.ts(x)`) and run in jsdom with `fetch`,
`next/navigation` and env values stubbed per file. State-changing BFF routes also reject
cross-origin requests (`src/lib/auth/csrf.ts`).

`e2e/auth.spec.ts` adds seven real-browser flows: signup, login, wrong-password rejection,
duplicate-email signup, cross-origin auth rejection, silent refresh after the access cookie is
invalidated, and logout (cookie clearing plus refresh-token revocation). They use
Chromium against `http://localhost:3000` by default; set `E2E_BASE_URL` and `E2E_API_URL` for a
different stack. The CI `sqlite` job installs Chromium and runs the same command after its
integration tests, reusing the services it already started.

> `output: "standalone"` is enabled for Docker. For a local production preview use the standalone
> server (`node .next/standalone/server.js`) or accept the warning from `next start`.
