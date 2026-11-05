# ADR 0001 — Monorepo foundation with separate deployables

- **Status:** Accepted
- **Date:** 2026-11-05
- **Deciders:** Platform engineering

## Context

Nexa AI needs a starting point for an AI product platform: a web application, an API that will host
increasingly complex workflows, a place for model training/serving code, and a delivery pipeline.
The team is small, the domain is still being discovered, and the cost of a mid-flight re-architecture
is high. The choices that matter most now are boundaries and contracts, not frameworks.

Constraints and forces:

- One repository must remain reviewable; contributors should not need to learn three toolchains at
  once.
- Services must deploy independently so the web tier can ship without redeploying the API.
- GPU/model dependencies must not leak into the request path.
- Configuration must be safe by default — this will eventually run in production.

## Decision

Use a **single repository with four top-level workspaces** — `frontend/`, `backend/`, `ml/`, plus
shared `docs/`, `scripts/`, `tests/` — each with its own manifest and dependencies, without a
monorepo build orchestrator.

1. `frontend/` and `backend/` are independently deployable services with separate Docker images and
   health endpoints.
2. `ml/` is a **library**, not a service. It owns the pipeline contract and registry; serving
   runtimes depend on it.
3. Contracts are explicit: Pydantic schemas on the server, mirrored TypeScript types on the client,
   versioned under `/api/v1`.
4. Cross-service verification lives in `tests/` and runs against a real Compose stack in CI.
5. CI is path-scoped by working directory and fans out into independent jobs (backend, frontend,
   ML, containers), so a frontend change does not wait on the Python toolchain and vice versa.

## Consequences

**Positive**

- Independent deployables and images; the API can scale without the web tier.
- Clear ownership: a feature usually touches one workspace plus a contract file.
- No orchestrator to maintain early on; npm and pip stay native and familiar.
- Tests and migrations run the same way locally and in CI.

**Negative / accepted trade-offs**

- Two package managers (npm, pip) and two dependency graphs to keep healthy.
- Shared code between frontend and backend cannot be imported directly; it is duplicated as
  contracts. This is deliberate: it preserves deploy independence and prevents accidental coupling.
- CI is a four-job fan-out; total pipeline time is dominated by the container job.
- Adding a third deployable later (e.g. an inference service) means adding another workspace and a
  Compose service, not reworking the repository.

## Alternatives considered

- **Polyrepo (separate frontend/backend/ML repos).** Strong isolation, but cross-cutting changes
  (contract updates, CI, versioning) become coordination work too early.
- **Turborepo/Nx orchestration.** Useful at larger scale, but adds configuration and a task graph
  before there is a performance problem to solve.
- **Single Next.js app with API routes instead of FastAPI.** Simplest path, rejected because the
  platform needs long-running async work, Python ML tooling and independent scaling of the API.
- **A shared TypeScript/Python codegen pipeline for contracts.** Attractive, but an OpenAPI-generated
  client is better introduced once the API surface is larger; today the schemas are small.

## Follow-up decisions

- Authentication: session cookies vs. bearer tokens, and where tenancy is enforced.
- Async work: queue/worker technology for ingestion and long-running inference.
- Contract generation: adopt an OpenAPI → TypeScript client when endpoint count justifies it.
