-- DevHub HQ · 0300 · Releases, raw events, grouped issues and metric rollups.
--
-- All rows in this file are written by the ingestion pipeline with the
-- service role. Clients get read-only access scoped to their organizations.
-- Growth is bounded by app.prune_telemetry() (0700_retention.sql).

create table public.releases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  version text not null check (char_length(version) between 1 and 200),
  commit_sha text check (commit_sha ~ '^[0-9a-f]{7,64}$'),
  first_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (project_id, organization_id) references public.projects (id, organization_id) on delete cascade,
  unique (project_id, version),
  unique (id, project_id)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  environment_id uuid not null,
  release_id uuid,
  kind text not null check (kind in ('error', 'message', 'request', 'vital', 'custom')),
  level text check (level in ('fatal', 'error', 'warning', 'info', 'debug')),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  fingerprint text check (char_length(fingerprint) <= 128),
  issue_id uuid,
  trace_id text check (char_length(trace_id) <= 64),
  -- SDK-provided event id; retried deliveries are dropped on conflict.
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 128),
  size_bytes integer not null check (size_bytes between 0 and 262144),
  payload jsonb not null,
  foreign key (project_id, organization_id) references public.projects (id, organization_id) on delete cascade,
  foreign key (environment_id, project_id) references public.environments (id, project_id) on delete cascade,
  foreign key (release_id, project_id) references public.releases (id, project_id) on delete set null (release_id),
  unique (project_id, idempotency_key),
  unique (id, project_id)
);
create index events_project_received_idx on public.events (project_id, received_at desc);
create index events_received_brin on public.events using brin (received_at);
create index events_issue_idx on public.events (issue_id, received_at desc) where issue_id is not null;

create table public.issues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  fingerprint text not null check (char_length(fingerprint) <= 128),
  title text not null check (char_length(title) <= 500),
  culprit text check (char_length(culprit) <= 500),
  exception_type text check (char_length(exception_type) <= 200),
  level text not null default 'error' check (level in ('fatal', 'error', 'warning', 'info')),
  status text not null default 'unresolved' check (status in ('unresolved', 'resolved', 'ignored', 'regressed')),
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  occurrence_count bigint not null default 0 check (occurrence_count >= 0),
  environment_ids uuid[] not null default '{}',
  first_release_id uuid,
  last_release_id uuid,
  resolved_at timestamptz,
  resolved_by uuid references public.users (id) on delete set null,
  resolved_in_release_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, organization_id) references public.projects (id, organization_id) on delete cascade,
  foreign key (first_release_id, project_id) references public.releases (id, project_id) on delete set null (first_release_id),
  foreign key (last_release_id, project_id) references public.releases (id, project_id) on delete set null (last_release_id),
  foreign key (resolved_in_release_id, project_id) references public.releases (id, project_id) on delete set null (resolved_in_release_id),
  unique (project_id, fingerprint),
  unique (id, project_id)
);
create index issues_project_status_idx on public.issues (project_id, status, last_seen_at desc);
create index issues_org_last_seen_idx on public.issues (organization_id, last_seen_at desc) where status in ('unresolved', 'regressed');
create trigger issues_touch before update on public.issues
  for each row execute function app.touch_updated_at();

alter table public.events
  add foreign key (issue_id, project_id) references public.issues (id, project_id) on delete set null (issue_id);

-- A bounded sample of occurrences per issue (summary only; full payload lives in events).
create table public.issue_occurrences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  issue_id uuid not null,
  environment_id uuid not null,
  release_id uuid,
  event_id uuid,
  occurred_at timestamptz not null,
  summary jsonb not null default '{}'::jsonb,
  foreign key (issue_id, project_id) references public.issues (id, project_id) on delete cascade,
  foreign key (project_id, organization_id) references public.projects (id, organization_id) on delete cascade,
  foreign key (environment_id, project_id) references public.environments (id, project_id) on delete cascade,
  foreign key (release_id, project_id) references public.releases (id, project_id) on delete set null (release_id),
  foreign key (event_id, project_id) references public.events (id, project_id) on delete set null (event_id)
);
create index issue_occurrences_issue_idx on public.issue_occurrences (issue_id, occurred_at desc);
create index issue_occurrences_occurred_brin on public.issue_occurrences using brin (occurred_at);

-- Pre-aggregated metric buckets (never one row per request).
create table public.metric_samples (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  environment_id uuid not null,
  metric text not null check (metric ~ '^[a-z0-9_.]{1,64}$'),
  bucket_start timestamptz not null,
  bucket_seconds integer not null check (bucket_seconds in (60, 3600, 86400)),
  -- Low-cardinality dimensions only (route template, method, status class).
  dimensions jsonb not null default '{}'::jsonb check (jsonb_typeof(dimensions) = 'object'),
  dimensions_key text not null default '',
  count bigint not null check (count >= 0),
  sum double precision not null,
  min double precision,
  max double precision,
  p50 double precision,
  p95 double precision,
  p99 double precision,
  error_count bigint not null default 0 check (error_count >= 0),
  foreign key (project_id, organization_id) references public.projects (id, organization_id) on delete cascade,
  foreign key (environment_id, project_id) references public.environments (id, project_id) on delete cascade,
  unique (environment_id, metric, bucket_seconds, bucket_start, dimensions_key)
);
create index metric_samples_query_idx on public.metric_samples (project_id, metric, bucket_seconds, bucket_start desc);

alter table public.releases enable row level security;
alter table public.events enable row level security;
alter table public.issues enable row level security;
alter table public.issue_occurrences enable row level security;
alter table public.metric_samples enable row level security;

revoke all on public.releases, public.events, public.issues, public.issue_occurrences, public.metric_samples
  from anon, authenticated;
grant select on public.releases, public.events, public.issues, public.issue_occurrences, public.metric_samples
  to authenticated;
-- Triage is a narrow, audited write.
grant update (status) on public.issues to authenticated;

create policy releases_select on public.releases for select to authenticated
  using (organization_id in (select app.user_org_ids()));
create policy events_select on public.events for select to authenticated
  using (organization_id in (select app.user_org_ids()));
create policy issues_select on public.issues for select to authenticated
  using (organization_id in (select app.user_org_ids()));
create policy issues_triage on public.issues for update to authenticated
  using (app.has_project_role(project_id, 'developer'))
  with check (app.has_project_role(project_id, 'developer') and status in ('unresolved', 'resolved', 'ignored'));
create policy issue_occurrences_select on public.issue_occurrences for select to authenticated
  using (organization_id in (select app.user_org_ids()));
create policy metric_samples_select on public.metric_samples for select to authenticated
  using (organization_id in (select app.user_org_ids()));

create trigger issues_audit after update of status on public.issues
  for each row execute function app.audit_row_change();

grant all on all tables in schema public to service_role;
