# Architecture

DevHub HQ is a **modular monolith** on a **Supabase-first** backend: one
PostgreSQL database (Supabase) is the source of truth, with separately
runnable processes that share typed contracts.

## Components

```mermaid
flowchart LR
  subgraph Browser
    UI[Dashboard UI<br/>HTML + RSC payloads]
  end
  subgraph "apps/web — Next.js 16"
    PX[proxy.ts<br/>request id · session refresh · auth redirect]
    RSC[Server Components<br/>read via RLS]
    SA[Server Actions<br/>validate → authorize → RPC]
  end
  subgraph "apps/api — Hono"
    V1[/v1 health · ready<br/>Phase 2: ingestion/]
  end
  subgraph "Supabase"
    AUTH[Supabase Auth<br/>password · magic link · TOTP MFA]
    PGR[PostgREST]
    PG[(PostgreSQL<br/>RLS · triggers · RPCs)]
  end
  SDK[Monitored apps<br/>Phase 2 SDKs] -.->|batched events| V1
  UI --> PX --> RSC & SA
  RSC & SA -->|user JWT| PGR --> PG
  SA --> AUTH
  V1 -.->|service role, Phase 2| PG
```

The browser talks **only to the DevHub origin**. Supabase is reached from the
server with the signed-in user's JWT, so every dashboard read and write is
subject to Row Level Security. The service-role key is never loaded by the
dashboard; from Phase 2 it is used only by `apps/api` (and a worker, if one
becomes necessary) after server-side authentication of SDK credentials.

## Request flow: registering a project

```mermaid
sequenceDiagram
  actor U as Admin
  participant W as Server Action (createProject)
  participant A as @devhub/auth
  participant DB as Postgres (create_project RPC)
  U->>W: submit form (same-origin POST, Next CSRF check)
  W->>W: requireWorkspace(): verify JWT (getClaims), MFA step-up, active org
  W->>A: authorize(ctx, "project:create")
  A-->>W: allowed / denied (reason)
  W->>W: zod: createProjectInputSchema
  W->>DB: rpc create_project(org, payload) as user
  DB->>DB: has_org_role(org,'admin')? constraints? insert project + environments
  DB->>DB: audit triggers write audit_logs (actor = auth.uid())
  DB-->>W: project id
  W-->>U: redirect /projects/:slug
```

Authorization is enforced **twice, independently**: in TypeScript before the
call (clear error messages, no wasted round trips) and in the database (RLS,
column grants and `SECURITY DEFINER` RPCs that re-check roles). A bug in one
layer does not open the data.

## Repository layout

| Path                    | Responsibility                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| `apps/web`              | Dashboard: pages, server actions, proxy. No service-role access.                                  |
| `apps/api`              | Versioned HTTP API. Phase 1: health/readiness and shared conventions. Phase 2: ingestion gateway. |
| `packages/contracts`    | Zod schemas and closed vocabularies shared by every process; health derivation.                   |
| `packages/auth`         | Roles, permissions, `authorize()`. Pure and unit-tested.                                          |
| `packages/database`     | Typed schema for supabase-js, DB error mapping, PGlite test harness, migration checker.           |
| `packages/ui`           | Accessible, token-driven React components.                                                        |
| `supabase/migrations`   | Versioned SQL — the schema, RLS, grants, RPCs, retention.                                         |
| `infrastructure/docker` | Dockerfiles and compose.                                                                          |
| `tests/e2e`             | Playwright tests against the production build.                                                    |

Dependency direction is one-way: `apps/* → packages/*`, and
`database → auth, contracts`. No package imports an app; there are no cycles.

Planned packages (`sdk-core`, `sdk-browser`, `sdk-node`, `sdk-nextjs`,
`integrations`, `telemetry`, `testing`) are created in the phase that first
needs them rather than as empty shells.

## Key decisions

| Decision                                                     | Why                                                                                                                                                                                               |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase Postgres as the only datastore in Phase 1           | Requirements favour starting with Postgres-based event storage. Redis/BullMQ, a separate worker and specialized telemetry storage are added only when load tests justify them (see `roadmap.md`). |
| Dashboard reads through RLS with the user's JWT              | Tenant isolation does not depend on every query remembering a `where organization_id = …`.                                                                                                        |
| Writes through RPCs / column grants, never table-wide INSERT | Clients cannot set server-managed fields (`connection_status`, ownership, timestamps). Enforced by `pnpm db:check`.                                                                               |
| Audit by database triggers                                   | Every write path — dashboard, SQL console, future workers — is recorded; the log is append-only even for the service role.                                                                        |
| Runtime (not build-time) Supabase config                     | One image for every environment; Supabase URL/key never appear in the JS bundle (e2e-tested).                                                                                                     |
| PGlite (PostgreSQL 18 in WASM) for DB tests                  | Real Postgres semantics (RLS, grants, triggers) with no Docker requirement. CI additionally applies migrations to real Supabase Postgres.                                                         |
| Hono for `apps/api`                                          | Small, fast, standards-based (`Request`/`Response`), trivially testable with `app.request()`.                                                                                                     |
