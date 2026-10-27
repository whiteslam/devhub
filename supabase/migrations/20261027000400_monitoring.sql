-- DevHub HQ · 0400 · Uptime checks, alert rules and incidents.

create table public.uptime_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  environment_id uuid not null,
  name text not null check (char_length(name) between 1 and 80),
  url text not null check (url ~ '^https?://' and char_length(url) <= 2048),
  method text not null default 'GET' check (method in ('GET', 'HEAD')),
  interval_seconds integer not null default 60 check (interval_seconds between 30 and 3600),
  timeout_ms integer not null default 10000 check (timeout_ms between 1000 and 30000),
  expected_status integer[] not null default '{200}',
  enabled boolean not null default true,
  last_checked_at timestamptz,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, organization_id) references public.projects (id, organization_id) on delete cascade,
  foreign key (environment_id, project_id) references public.environments (id, project_id) on delete cascade,
  unique (id, project_id)
);
create index uptime_checks_due_idx on public.uptime_checks (last_checked_at nulls first) where enabled;
create trigger uptime_checks_touch before update on public.uptime_checks
  for each row execute function app.touch_updated_at();

create table public.check_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  check_id uuid not null,
  checked_at timestamptz not null default now(),
  ok boolean not null,
  status_code integer,
  response_ms integer check (response_ms >= 0),
  region text check (char_length(region) <= 32),
  error text check (char_length(error) <= 1000),
  foreign key (check_id, project_id) references public.uptime_checks (id, project_id) on delete cascade,
  foreign key (project_id, organization_id) references public.projects (id, organization_id) on delete cascade
);
create index check_results_check_idx on public.check_results (check_id, checked_at desc);
create index check_results_checked_brin on public.check_results using brin (checked_at);

create table public.alert_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- null: applies to every project in the organization
  project_id uuid,
  name text not null check (char_length(name) between 1 and 80),
  kind text not null check (kind in ('error_rate', 'latency_p95', 'uptime', 'new_issue', 'regression', 'missing_data')),
  threshold numeric,
  window_seconds integer not null default 300 check (window_seconds between 60 and 86400),
  severity text not null default 'major' check (severity in ('critical', 'major', 'minor')),
  -- Routing references only (e.g. integration ids, channel names). Secrets such
  -- as webhook URLs belong in integrations.credentials_ciphertext.
  channels jsonb not null default '[]'::jsonb check (jsonb_typeof(channels) = 'array'),
  enabled boolean not null default true,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, organization_id) references public.projects (id, organization_id) on delete cascade,
  unique (id, organization_id)
);
create index alert_rules_org_idx on public.alert_rules (organization_id) where enabled;
create trigger alert_rules_touch before update on public.alert_rules
  for each row execute function app.touch_updated_at();

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  environment_id uuid,
  alert_rule_id uuid,
  title text not null check (char_length(title) <= 300),
  severity text not null check (severity in ('critical', 'major', 'minor')),
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  -- one open incident per condition
  dedupe_key text not null check (char_length(dedupe_key) <= 200),
  reason text check (char_length(reason) <= 2000),
  opened_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid references public.users (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, organization_id) references public.projects (id, organization_id) on delete cascade,
  foreign key (environment_id, project_id) references public.environments (id, project_id) on delete cascade,
  foreign key (alert_rule_id, organization_id) references public.alert_rules (id, organization_id) on delete set null (alert_rule_id)
);
create unique index incidents_open_dedupe_idx on public.incidents (project_id, dedupe_key) where status <> 'resolved';
create index incidents_org_status_idx on public.incidents (organization_id, status, opened_at desc);
create trigger incidents_touch before update on public.incidents
  for each row execute function app.touch_updated_at();

create trigger uptime_checks_audit after insert or update or delete on public.uptime_checks
  for each row execute function app.audit_row_change();
create trigger alert_rules_audit after insert or update or delete on public.alert_rules
  for each row execute function app.audit_row_change();
create trigger incidents_audit after update of status on public.incidents
  for each row execute function app.audit_row_change();

alter table public.uptime_checks enable row level security;
alter table public.check_results enable row level security;
alter table public.alert_rules enable row level security;
alter table public.incidents enable row level security;

revoke all on public.uptime_checks, public.check_results, public.alert_rules, public.incidents from anon, authenticated;
grant select on public.uptime_checks, public.check_results, public.incidents to authenticated;
grant select (id, organization_id, project_id, name, kind, threshold, window_seconds, severity, enabled, created_by,
  created_at, updated_at) on public.alert_rules to authenticated;

create policy uptime_checks_select on public.uptime_checks for select to authenticated
  using (organization_id in (select app.user_org_ids()));
create policy check_results_select on public.check_results for select to authenticated
  using (organization_id in (select app.user_org_ids()));
create policy alert_rules_select on public.alert_rules for select to authenticated
  using (organization_id in (select app.user_org_ids()));
create policy incidents_select on public.incidents for select to authenticated
  using (organization_id in (select app.user_org_ids()));

grant all on all tables in schema public to service_role;
