# Testing

| Layer                                                              | Tool                                   | Location                                                | Needs                        |
| ------------------------------------------------------------------ | -------------------------------------- | ------------------------------------------------------- | ---------------------------- |
| Domain logic (permissions, schemas, health, rate limiter, cursors) | Vitest                                 | `packages/*/src/*.test.ts`, `apps/web/src/**/*.test.ts` | nothing                      |
| Database: RLS, tenant isolation, grants, RPCs, audit, retention    | Vitest + PGlite                        | `packages/database/src/rls.test.ts`                     | nothing (PostgreSQL in WASM) |
| Migration invariants                                               | `pnpm db:check`                        | `packages/database/scripts/check-migrations.ts`         | nothing                      |
| API conventions                                                    | Vitest (`app.request`)                 | `apps/api/src/app.test.ts`                              | nothing                      |
| End-to-end                                                         | Playwright, desktop + mobile viewports | `tests/e2e`                                             | production build, Chromium   |
| Real Supabase compatibility                                        | Supabase CLI in CI                     | `.github/workflows/ci.yml`                              | Docker (CI)                  |

The PGlite harness (`packages/database/src/testing`) installs a minimal
Supabase shim — `anon`/`authenticated`/`service_role` roles, `auth.users`,
`auth.uid()`, `auth.jwt()` — then applies the real migrations. `asUser(id, fn,
{ aal })` runs `fn` in a transaction as `authenticated` with that JWT, exactly
as PostgREST would.

E2E runs two `next start` servers: one without Supabase (setup mode) and one
configured with an unreachable Supabase URL (signed-out guard, headers, bundle
hygiene). **Signed-in flows are not yet covered end-to-end**: they need a real
Supabase Auth instance. The next step is a CI job that runs `supabase start`
and drives sign-in → onboarding → project registration.
