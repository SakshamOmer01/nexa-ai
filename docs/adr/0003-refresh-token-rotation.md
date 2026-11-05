# ADR 0003 — Rotating refresh tokens with family revocation

- Status: Accepted
- Date: 2026-11-05
- Amends: [ADR 0002](0002-jwt-authentication.md)

## Context

ADR 0002 introduced short-lived access JWTs, which cannot be revoked before `exp`. Users therefore
had to sign in again every `ACCESS_TOKEN_EXPIRE_MINUTES` (30 by default), and a stolen access token
stayed valid for its full lifetime. The next requirement is durable sessions with server-side
revocation, without turning the API into a stateful session store for every request.

Constraints:

- Stateless API replicas and no Redis; PostgreSQL is the only durable store.
- Tokens must stay out of JavaScript-readable browser storage (the BFF already owns httpOnly
  cookies).
- Concurrent requests (two tabs, an RSC prefetch) can present the same token at the same time.
- A database leak must not hand an attacker usable credentials.

## Decision

**Opaque refresh tokens stored as digests, grouped into per-login families.**

- Signup, login and refresh return `{ access_token, refresh_token, token_type, expires_in,
  refresh_expires_in, user }`. The refresh token is 256 bits from `secrets.token_urlsafe(32)`.
- Only `sha256(token)` is stored in `refresh_tokens`, alongside `user_id`, `family_id`, `expires_at`,
  `revoked_at` and `replaced_by_id`. Lookups are by digest; the plaintext exists only in the
  response and the client's cookie.
- Each login or signup creates a new family. Every refresh is **single use**: the presented row is
  revoked, linked to its successor, and a new access/refresh pair is returned in the same family.
- `POST /auth/refresh` rejects unknown, expired, inactive-account and revoked tokens with one
  generic `401`. A revoked token that has a successor and was revoked within a 30-second grace
  period is treated as a concurrent request: it is rejected without revoking the family. Replay
  outside that window is treated as theft and revokes every active token in the family.
- Rotation uses a conditional `UPDATE ... WHERE revoked_at IS NULL`, so two racing requests cannot
  branch a family; exactly one wins.
- `POST /auth/logout` revokes the presented token's whole family and is idempotent (`204`, even for
  unknown or missing tokens).
- Refresh lifetime comes from `REFRESH_TOKEN_EXPIRE_DAYS` (30 by default).

**Web tier:** `POST /api/auth/*` stores both tokens in httpOnly, SameSite=Lax cookies (Secure on
https). Before rendering, `src/proxy.ts` checks the access cookie's `exp`; when it is missing or
within 30 seconds of expiry it calls `/auth/refresh`, writes the rotated pair to the response and
forwards the new `Cookie` header to the current render. A failed refresh never clears cookies, so a
concurrent rotation or a brief API outage does not sign the user out. Logout asks the API to revoke
the family, then clears both cookies; if the API is unreachable, local sign-out still succeeds.

## Consequences

Positive:

- Sessions survive access-token expiry while access JWTs stay short-lived.
- Revocation is immediate for refresh tokens: logout, replay detection and deactivated accounts stop
  future refreshes.
- Digest storage means a read-only database leak exposes no usable token, and refresh tokens are
  never sent to browser JavaScript.
- The grace window keeps normal concurrent traffic from logging users out, while replay after the
  window still detects theft.
- No new infrastructure: rotation state is a table in the existing PostgreSQL database.

Trade-offs / limits:

- Access tokens remain stateless: a revoked session's access token works until its `exp` (at most
  `ACCESS_TOKEN_EXPIRE_MINUTES`). Shortening it reduces the window.
- Refresh and logout are extra database writes on the session path; the access-token path is
  unchanged.
- The 30-second grace means a stolen token replayed immediately after rotation is rejected but does
  not trigger family revocation. It cannot mint tokens, and later replay does revoke.
- Logout cannot revoke anything if the API is unreachable; the client still clears its cookies and
  the token expires on its own.
- Expired and revoked rows are retained for audit; a periodic cleanup job is a follow-up.
- Rate limiting on login/refresh is still a follow-up.

## Rejected alternatives

- **Longer-lived access JWTs.** No server-side revocation and a bigger theft window.
- **Refresh JWT instead of an opaque secret.** Revocation would still need a denylist, and a JWT
  carries claims that a random secret does not need.
- **Sliding sessions without rotation.** A stolen refresh token stays valid for its whole lifetime
  and is undetectable.
- **Rotation without a concurrency grace.** Two tabs refreshing at once would revoke the family and
  sign the user out; the grace is the smallest fix that preserves replay detection.
- **Server-side session per request (Redis/PostgreSQL).** Stronger immediate revocation, but every
  API request becomes stateful and adds a dependency the stack does not have.
