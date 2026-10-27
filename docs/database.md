# Database

PostgreSQL on Supabase is the source of truth. All schema changes are
versioned SQL in `supabase/migrations/` (applied in filename order).

| Migration         | Contents                                                                                                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `0100_foundation` | `app` schema, role enums, `users` (mirror of `auth.users`), `organizations`, `memberships`, `audit_logs`, authorization helpers, audit triggers, `create_organization`, `update_organization_security` |
| `0200_projects`   | `projects`, `environments`, `project_members`, `project_connections`, `api_credentials`, `create_project`, `archive_project`                                                                           |
| `0300_telemetry`  | `releases`, `events`, `issues`, `issue_occurrences`, `metric_samples`                                                                                                                                  |
| `0400_monitoring` | `uptime_checks`, `check_results`, `alert_rules`, `incidents`                                                                                                                                           |
| `0500_delivery`   | `integrations`, `deployments`, `webhook_deliveries`                                                                                                                                                    |
| `0600_business`   | `products`, `plans`, `subscriptions`                                                                                                                                                                   |
| `0700_retention`  | `app.prune_telemetry()`                                                                                                                                                                                |

## Conventions

- UUID primary keys (`gen_random_uuid()`), `timestamptz` everywhere (UTC).
- Closed vocabularies are `CHECK` constraints mirrored in
  `packages/contracts/src/catalog.ts` — change both together.
- Tenant isolation: `organization_id` on every tenant row plus composite FKs
  (see `security.md`).
- `updated_at` is maintained by trigger, never by clients.
- Idempotency: `events (project_id, idempotency_key)`,
  `webhook_deliveries (provider, delivery_id)`,
  `deployments (project_id, provider, provider_deployment_id)`,
  `subscriptions (provider, provider_subscription_id)`.
- Out-of-order provider events: `deployments.status_at` and
  `subscriptions.provider_updated_at` hold the provider's event time so older
  deliveries can be ignored.
- One open incident per condition: partial unique index on
  `incidents (project_id, dedupe_key) where status <> 'resolved'`.

## Indexes (by query pattern)

| Query                                    | Index                                                                              |
| ---------------------------------------- | ---------------------------------------------------------------------------------- |
| A user's organizations (every RLS check) | `memberships (user_id, organization_id)`                                           |
| Active projects in an org, by name       | partial `projects (organization_id, name) where archived_at is null`               |
| Latest events for a project              | `events (project_id, received_at desc)`; BRIN on `received_at` for retention scans |
| Issue list by status / recency           | `issues (project_id, status, last_seen_at desc)`                                   |
| Metric charts                            | `metric_samples (project_id, metric, bucket_seconds, bucket_start desc)`           |
| Due uptime checks                        | partial `uptime_checks (last_checked_at nulls first) where enabled`                |
| Audit log pages (keyset)                 | `audit_logs (organization_id, created_at desc, id desc)`                           |

## Growth control and retention

High-volume tables are bounded:

| Data                            | Retention                                                      |
| ------------------------------- | -------------------------------------------------------------- |
| `events`, `issue_occurrences`   | `organizations.telemetry_retention_days` (default 30, max 400) |
| `check_results`                 | 90 days                                                        |
| `metric_samples` 60 s buckets   | 14 days                                                        |
| `metric_samples` 1 h buckets    | 400 days                                                       |
| `metric_samples` 1 day buckets  | kept                                                           |
| `webhook_deliveries` (finished) | 30 days                                                        |
| `audit_logs`                    | 400 days                                                       |

Metrics are stored as **pre-aggregated buckets** (count, sum, min, max, p50,
p95, p99), never one row per request. `events.size_bytes` is constrained to
256 KiB; the ingestion API (Phase 2) measures and enforces a smaller limit
before insert.

`app.prune_telemetry(batch)` deletes in bounded batches. Schedule it with
pg_cron (enable the extension in the Supabase dashboard first):

```sql
select cron.schedule('devhub-prune', '*/15 * * * *', $$select * from app.prune_telemetry(5000)$$);
```

When `events` volume justifies it (see `roadmap.md` benchmarks), convert it to
a time-partitioned table and drop whole partitions instead of deleting rows.

## Workflow

```bash
pnpm db:check                     # apply all migrations to a fresh Postgres + check invariants
pnpm --filter @devhub/database test   # RLS / isolation / audit tests
supabase migration new <name>     # new migration file (Supabase CLI)
supabase db reset                 # local: recreate DB and apply all migrations
supabase db push                  # hosted: apply pending migrations
```

Migrations are forward-only. To undo a change, write a new migration.

### Types

`packages/database/src/types.ts` is hand-maintained for the tables the
dashboard reads. With the Supabase CLI running you can generate the full
schema types (`supabase gen types typescript --local`) and replace it, keeping
the exported `*Row` aliases.
