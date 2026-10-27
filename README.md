# DevHub HQ

Private command center for the applications you operate: projects and
environments, telemetry and errors, uptime and performance, deployments,
integrations, and — later — subscriptions and costs. Built on Supabase,
Next.js 16 and TypeScript.

**Status:** Phase 1 complete — authentication with MFA, organizations and
roles, project registry with environments, the full database schema with Row
Level Security, the dashboard shell, and the API process skeleton. Telemetry
ingestion starts in Phase 2. See [docs/roadmap.md](docs/roadmap.md).

## Quick start

```bash
nvm use                 # Node 24 LTS
pnpm install
pnpm ci                 # lint, types, migration checks, tests, builds
```

Run it against Supabase: [docs/local-development.md](docs/local-development.md).

## Repository

```
apps/web            Next.js dashboard (server actions, RLS-scoped reads)
apps/api            Versioned HTTP API (Hono) — ingestion lands here in Phase 2
packages/contracts  Shared zod schemas, vocabularies, health derivation
packages/auth       Roles, permissions, authorize()
packages/database   Typed schema, DB error mapping, PGlite test harness
packages/ui         Accessible UI components
supabase/           Migrations and Supabase CLI config
infrastructure/     Dockerfiles and compose
tests/e2e           Playwright
docs/               Architecture, security, database, API, operations
```

## Documentation

- [Architecture & data flow](docs/architecture.md)
- [Security & permission model](docs/security.md)
- [Database, retention & migrations](docs/database.md)
- [API conventions](docs/api.md)
- [Local development](docs/local-development.md) · [Testing](docs/testing.md)
- [Deployment](docs/deployment.md) · [Backup & recovery](docs/backup-recovery.md)
- [Roadmap, limitations & next steps](docs/roadmap.md)
- [Pipeline board plan (Rapport reverse-engineering notes)](docs/design/pipeline-board-plan.md)

## Principles

- Every displayed metric comes from real records — never sample data.
- Missing telemetry is shown as "No data" or "Stale", never as healthy.
- Authorization is checked in the server and again in the database.
- Owners are not exempt from checks (MFA requirements apply to them too).
