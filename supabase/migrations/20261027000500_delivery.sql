-- DevHub HQ · 0500 · Provider integrations, deployments and webhook deliveries.

create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- null: organization-wide (e.g. a GitHub installation)
  project_id uuid,
  provider text not null check (provider in ('github', 'vercel', 'coolify', 'docker', 'supabase', 'http_webhook')),
  name text not null check (char_length(name) between 1 and 80),
  status text not null default 'pending' check (status in ('pending', 'active', 'error', 'disabled')),
  -- Non-secret configuration only (team id, repo, app uuid…).
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  -- Capabilities the adapter verified for this connection, e.g. {deployments:read}.
  capabilities text[] not null default '{}',
  -- AES-256-GCM envelope produced by the server; never readable by clients.
  credentials_ciphertext text,
  credentials_key_version integer,
  last_synced_at timestamptz,
  last_error text check (char_length(last_error) <= 2000),
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, organization_id) references public.projects (id, organization_id) on delete cascade,
  check ((credentials_ciphertext is null) = (credentials_key_version is null)),
  unique (id, organization_id)
);
create index integrations_org_idx on public.integrations (organization_id, provider);
create trigger integrations_touch before update on public.integrations
  for each row execute function app.touch_updated_at();

create table public.deployments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  environment_id uuid not null,
  release_id uuid,
  integration_id uuid,
  provider text not null check (provider in ('github', 'vercel', 'coolify', 'docker', 'supabase', 'http_webhook', 'manual')),
  provider_deployment_id text check (char_length(provider_deployment_id) <= 200),
  status text not null check (status in ('queued', 'building', 'deploying', 'ready', 'error', 'canceled', 'rolled_back')),
  trigger text not null check (trigger in ('provider_event', 'manual', 'rollback')),
  triggered_by uuid references public.users (id) on delete set null,
  -- For rollbacks: the deployment being restored.
  rollback_of uuid,
  url text check (char_length(url) <= 2048),
  -- Provider event time of the latest status; used to ignore out-of-order deliveries.
  status_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  health_check_status text check (health_check_status in ('pending', 'passed', 'failed', 'skipped')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, organization_id) references public.projects (id, organization_id) on delete cascade,
  foreign key (environment_id, project_id) references public.environments (id, project_id) on delete cascade,
  foreign key (release_id, project_id) references public.releases (id, project_id) on delete set null (release_id),
  foreign key (integration_id, organization_id) references public.integrations (id, organization_id) on delete set null (integration_id),
  foreign key (rollback_of, project_id) references public.deployments (id, project_id) on delete set null (rollback_of),
  unique (id, project_id)
);
create unique index deployments_provider_idx on public.deployments (project_id, provider, provider_deployment_id)
  where provider_deployment_id is not null;
create index deployments_project_created_idx on public.deployments (project_id, created_at desc);
create trigger deployments_touch before update on public.deployments
  for each row execute function app.touch_updated_at();

create table public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  integration_id uuid,
  provider text not null check (char_length(provider) <= 32),
  -- Provider's delivery id (X-GitHub-Delivery, etc.); duplicates are rejected.
  delivery_id text not null check (char_length(delivery_id) <= 200),
  event_type text check (char_length(event_type) <= 100),
  signature_valid boolean not null,
  status text not null default 'received' check (status in ('received', 'processed', 'failed', 'duplicate', 'rejected')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text check (char_length(last_error) <= 2000),
  payload jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, delivery_id),
  -- A delivery tied to an integration is always tied to that integration's tenant.
  foreign key (integration_id, organization_id) references public.integrations (id, organization_id) on delete set null (integration_id),
  check (integration_id is null or organization_id is not null)
);
create index webhook_deliveries_org_idx on public.webhook_deliveries (organization_id, received_at desc);
create index webhook_deliveries_pending_idx on public.webhook_deliveries (received_at) where status in ('received', 'failed');

create trigger integrations_audit after insert or update or delete on public.integrations
  for each row execute function app.audit_row_change();
create trigger deployments_audit after insert on public.deployments
  for each row execute function app.audit_row_change();

alter table public.integrations enable row level security;
alter table public.deployments enable row level security;
alter table public.webhook_deliveries enable row level security;

revoke all on public.integrations, public.deployments, public.webhook_deliveries from anon, authenticated;
grant select (id, organization_id, project_id, provider, name, status, config, capabilities, last_synced_at,
  last_error, created_by, created_at, updated_at) on public.integrations to authenticated;
grant select on public.deployments to authenticated;
grant select (id, organization_id, integration_id, provider, delivery_id, event_type, signature_valid, status,
  attempts, last_error, received_at, processed_at) on public.webhook_deliveries to authenticated;

create policy integrations_select on public.integrations for select to authenticated
  using (organization_id in (select app.user_org_ids()));
create policy deployments_select on public.deployments for select to authenticated
  using (organization_id in (select app.user_org_ids()));
create policy webhook_deliveries_select on public.webhook_deliveries for select to authenticated
  using (app.has_org_role(organization_id, 'admin'));

grant all on all tables in schema public to service_role;
