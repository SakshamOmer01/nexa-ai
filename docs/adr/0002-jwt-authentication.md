# ADR 0002 — JWT authentication with an httpOnly web session

- Status: Accepted
- Date: 2026-11-05

## Context

The foundation shipped a `users` table plus audited crypto helpers (Argon2id, JWT encode/decode)
but no auth surface. The platform needs accounts before multi-tenant workspaces, API keys or
per-user inference jobs can exist. Constraints:

- Stateless API replicas; no sticky sessions or server-side session store yet.
- PostgreSQL is the only durable store; Redis is not part of the stack.
- The web app is server-first (RSC) and the API is a separate origin.
- Tokens must not be exposed to browser JavaScript, where any XSS becomes token theft.
- The architecture requires thin routers, services returning schemas, and one error envelope.

## Decision

**API:** email/password accounts with Argon2id hashes and short-lived HS256 JWT access tokens.

- `POST /api/v1/auth/signup` and `POST /api/v1/auth/login` return
  `{ access_token, token_type, expires_in, user }`.
- Claims are `sub` (user UUID), `iat`, `exp` and `type: access`; `decode_access_token` requires
  `sub`/`exp` and rejects any other token type.
- `GET /api/v1/auth/me` is the protected route. A reusable `get_current_user` dependency validates
  the bearer token, resolves an active user row and exposes a narrow `UserResponse` — no ORM object
  reaches the router.
- Login failures (unknown email, wrong password, deactivated account) use one identical `401` and a
  dummy Argon2 verification when no row matches, so neither responses nor timing enumerate users.
- Emails are validated with `EmailStr` and normalised to lower case; the unique index is the final
  authority on duplicates, with `IntegrityError` mapped to `409`.

**Web:** route handlers under `/api/auth/*` act as a same-origin BFF.

- Login/signup call the API server-side, store the token in an **httpOnly, SameSite=Lax** cookie
  (`Secure` when `NEXT_PUBLIC_SITE_URL` is https, `Max-Age` from `expires_in`) and return only the
  public user.
- Server components read the cookie through `src/lib/auth/session.ts` and call `/auth/me` for the
  signed-in header state and the `/dashboard` page.
- `src/proxy.ts` redirects requests without a session cookie away from `/dashboard`; the API call
  remains the authoritative check because an attacker can send any cookie value.

## Consequences

Positive:

- API instances stay stateless; horizontal scaling needs no shared session store.
- The browser never sees the token, so client-side XSS cannot read or exfiltrate it, and no token
  is written to `localStorage`.
- Cookie flags (`httpOnly`, `SameSite=Lax`, `Secure` on https) close the common CSRF and transport
  gaps for a same-origin BFF.
- Services, schemas and deps keep auth logic out of routers and reusable by future surfaces.

Trade-offs / limits:

- Revocation is not immediate: a stolen token stays valid until `exp`. Mitigations are the short
  lifetime, `is_active` checks on every request, and `SECRET_KEY` rotation (which invalidates all
  tokens). Refresh tokens, a token version/denylist and per-device sessions are follow-ups.
- BFF routes require the web tier to reach the API (`API_INTERNAL_URL`); a web-only deployment
  cannot authenticate users.
- `SameSite=Lax` plus JSON-only routes is the CSRF defence; a dedicated token/Origin check would be
  needed if cross-site embedding is ever added.
- No rate limiting on login yet; a shared limiter belongs in front of the API before public launch.

## Rejected alternatives

- **Browser stores the JWT (localStorage/sessionStorage) and calls the API directly.** Simplest, but
  any XSS steals a long-lived bearer token and SSR cannot render signed-in state.
- **Server-side sessions in PostgreSQL/Redis with an opaque cookie.** Strong revocation, but adds a
  lookup/binding per request and a new dependency the foundation does not have.
- **httpOnly cookie issued by FastAPI directly.** Requires shared cookie domain or cross-origin
  credential handling, and makes the API responsible for browser transport; the BFF keeps that
  concern in the web tier.
- **Long-lived tokens instead of expiry.** Rejected: expiry is the only revocation mechanism
  available without a denylist.
