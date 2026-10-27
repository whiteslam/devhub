# Local development

## Prerequisites

- Node.js **24 LTS** (`.nvmrc` pins 24.22.1; Node 22.18+ also works).
  Node 23 is not supported by the toolchain.
- pnpm 10 (`corepack enable` picks the pinned version).
- For a full local stack: Docker + the [Supabase CLI](https://supabase.com/docs/guides/local-development).

Tests and migration checks need **neither Docker nor a database**: they run
real PostgreSQL in-process (PGlite).

## Install and verify

```bash
nvm use            # or: nvm install 24.22.1
pnpm install
pnpm check         # lint + format (Biome)
pnpm typecheck
pnpm db:check      # apply migrations to fresh Postgres, verify security invariants
pnpm test          # unit, RLS/isolation, API tests
pnpm build         # production builds of web and api
pnpm exec playwright install chromium && pnpm e2e
```

## Run against a local Supabase

```bash
supabase start                     # starts Postgres, Auth, PostgREST, Studio; applies supabase/migrations
cp .env.example apps/web/.env.local
# set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY from `supabase start` output
pnpm dev                           # web on :3000, api on :4000
```

1. Open http://localhost:3000 — you are sent to `/login`.
2. Create your account: either set `DEVHUB_ALLOW_SIGNUP=true` once in
   `apps/web/.env.local`, or add a user in Supabase Studio
   (http://localhost:54323 → Authentication). Local auth emails are visible in
   Inbucket at http://localhost:54324.
3. Sign in, create your organization, register a project.
4. Optional: Settings → Security & sessions → set up an authenticator app.
   Once enrolled, every session needs the TOTP code before any data is
   visible (enforced by the database).

Without Supabase configured, every page redirects to `/setup`; the dashboard
never shows sample data.

## Useful commands

| Command                         | What it does                                       |
| ------------------------------- | -------------------------------------------------- |
| `pnpm dev`                      | Web (Next dev server) and API (tsx watch) together |
| `pnpm --filter @devhub/web dev` | Dashboard only                                     |
| `pnpm format`                   | Apply formatting                                   |
| `supabase db reset`             | Recreate the local DB from migrations              |
| `supabase migration new add_x`  | Create a new migration                             |
