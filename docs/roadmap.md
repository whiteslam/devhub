# Roadmap, limitations and next steps

## Phase status

| Phase | Scope                                                                              | Status                       |
| ----- | ---------------------------------------------------------------------------------- | ---------------------------- |
| 1     | Architecture, auth, project registry, environments, full schema, dashboard shell   | **Done** (see limitations)   |
| 2     | Browser / Node / Next.js SDKs, ingestion gateway, credentials, connection wizard   | Next                         |
| 3     | Error grouping, uptime, performance metrics, alerts, incidents, issue triage board | Planned                      |
| 4     | GitHub, Vercel, Coolify, Docker, Supabase adapters                                 | Planned                      |
| 5     | Guarded deployments, release correlation, audited rollback                         | Planned                      |
| 6     | Products, plans, subscriptions, cost reporting                                     | Schema ready; module planned |
| 7     | Automated testing engines, AI-assisted diagnostics                                 | Planned                      |

## Known limitations of Phase 1

- **No telemetry yet.** Every project shows "No data" until Phase 2 SDKs and
  verification exist. This is intentional — absence of data is never shown as
  healthy.
- **Signed-in flows are not covered by e2e tests.** Auth, onboarding and
  project registration are covered at the database (PGlite) and unit level;
  the browser flow needs a real Supabase Auth instance (CI job planned).
- **Member management is read-only.** Invitations and role changes need an
  invite flow (Phase 2). Until then, add members with the service role or SQL.
- **Rate limiting is per process** for DevHub's own auth actions (Supabase
  Auth applies its own global limits).
- **CSP allows inline scripts** (Next.js bootstrap). Nonce-based CSP is a
  follow-up.
- **Database types are hand-written** for the tables the dashboard uses;
  regenerate with the Supabase CLI when available.
- **Docker images were not built locally** (no Docker on the build machine);
  the same build artifacts were verified by running them directly. CI builds
  will be the first real image build.
- **Hosted-Supabase compatibility is verified** (2026-10-27): all 7
  migrations applied to the project's PostgreSQL 17.11; security invariants
  and a rolled-back isolation / MFA / audit probe passed on the live database.
  The CI job will repeat the migration check on every push.
- **Only TOTP factors are supported in the UI.** The database requires AAL2
  for any verified factor type; a user who somehow has only a phone/WebAuthn
  factor (created outside DevHub) cannot step up and must have it removed.
- **Per-account sign-in limits can be used to slow a known user's sign-in**
  (10 attempts / 15 min). Accepted trade-off for brute-force protection;
  exponential backoff is a possible refinement.
- **No MFA recovery codes yet.** A lost authenticator needs operator
  recovery (`backup-recovery.md`). Enroll a second factor as backup.
- **Removing a member or changing roles** is SQL-only in Phase 1.
- Light theme is not implemented (tokens are ready for it).

## Prioritized next steps

1. Create the owner account in Supabase (Authentication → Users → Add user),
   sign in, and exercise onboarding → project registration. Then disable
   public sign-up and reset the database password (see the security checklist).
2. Push to GitHub so CI runs the real-Supabase migration job and e2e.
3. Phase 2, in order: member invitations · credential creation/rotation/revoke
   UI · `packages/sdk-core` event contract + `sdk-browser` · `/v1/events`
   ingestion (auth, validation, size limits, redaction, idempotency, project
   rate limits) · connection wizard with verification checks · `sdk-node` and
   `sdk-nextjs`.
4. Signed-in e2e suite against `supabase start` in CI.
5. Ingestion benchmark before choosing queues: measure p95 insert latency,
   events/s per instance, DB connections and storage growth at 10×
   expected volume; add Redis/BullMQ + `apps/worker` only if PostgreSQL-only
   ingestion misses the SLOs below.

## Initial service-level objectives

Targets to validate with load tests in Phase 2–3 (not yet measured):

| SLO                                      | Target                                                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Dashboard availability                   | 99.9 % monthly                                                                                         |
| Dashboard page server time (p95, warm)   | < 400 ms                                                                                               |
| Ingestion acceptance (p95, `/v1/events`) | < 150 ms                                                                                               |
| Event visible in dashboard (p95)         | < 60 s                                                                                                 |
| Uptime check scheduling drift (p95)      | < 15 s                                                                                                 |
| Pipeline self-monitoring                 | DevHub's own ingestion failures, queue backlog, latency and worker health are surfaced on its overview |
