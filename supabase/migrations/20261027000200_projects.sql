-- DevHub HQ · 0200 · Project registry, environments, project grants,
-- connection verification state and telemetry credentials.

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  slug text not null check (app.is_valid_slug(slug)),
  framework text not null check (framework in (
    'nextjs', 'react', 'vue', 'nuxt', 'svelte', 'astro', 'remix', 'node', 'express',
    'fastify', 'nestjs', 'static', 'other')),
  app_type text not null check (app_type in ('web_app', 'api', 'website', 'worker', 'mobile', 'other')),
  base_url text check (base_url ~ '^https?://' and char_length(base_url) <= 2048),
  repository_url text check (repository_url ~ '^https?://' and char_length(repository_url) <= 2048),
  hosting_provider text not null check (hosting_provider in (
    'vercel', 'coolify', 'docker', 'supabase', 'netlify', 'cloudflare', 'aws', 'self_hosted', 'other')),
  release_strategy text not null check (release_strategy in ('git_sha', 'semver', 'build_id', 'manual')),
  monitoring_config jsonb not null default '{}'::jsonb check (jsonb_typeof(monitoring_config) = 'object'),
  -- Maintained by the verification pipeline only (no client UPDATE grant).
  connection_status text not null default 'pending'
    check (connection_status in ('pending', 'partial', 'connected', 'degraded')),
  last_event_at timestamptz,
  created_by uuid references public.users (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug),
  -- target for composite FKs from child tables (tenant consistency)
  unique (id, organization_id)
);
create index projects_org_active_idx on public.projects (organization_id, name) where archived_at is null;
create trigger projects_touch before update on public.projects
  for each row execute function app.touch_updated_at();

create table public.environments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  name text not null check (char_length(name) between 1 and 64),
  slug text not null check (app.is_valid_slug(slug)),
  kind text not null check (kind in ('production', 'staging', 'development', 'preview')),
  base_url text check (base_url ~ '^https?://' and char_length(base_url) <= 2048),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, organization_id) references public.projects (id, organization_id) on delete cascade,
  unique (project_id, slug),
  unique (id, project_id)
);
create index environments_org_idx on public.environments (organization_id);
create trigger environments_touch before update on public.environments
  for each row execute function app.touch_updated_at();

-- Per-project role grants that elevate an existing org member on one project.
create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  user_id uuid not null,
  role public.project_role not null,
  created_at timestamptz not null default now(),
  foreign key (project_id, organization_id) references public.projects (id, organization_id) on delete cascade,
  foreign key (organization_id, user_id) references public.memberships (organization_id, user_id) on delete cascade,
  unique (project_id, user_id)
);
create index project_members_user_idx on public.project_members (user_id);

-- Effective role on a project: the stronger of the org role and any project grant.
create function app.project_role(p_project uuid) returns public.org_role
language sql stable security definer set search_path = ''
as $$
  select greatest(m.role, pm.role::text::public.org_role)
  from public.projects p
  join public.memberships m on m.organization_id = p.organization_id and m.user_id = auth.uid()
  left join public.project_members pm on pm.project_id = p.id and pm.user_id = auth.uid()
  where p.id = p_project and app.aal_satisfied(p.organization_id)
$$;

create function app.has_project_role(p_project uuid, p_min public.org_role) returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(app.project_role(p_project) >= p_min, false) $$;

-- Verification checks for each way telemetry reaches DevHub (Phase 2 fills these).
create table public.project_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  environment_id uuid not null,
  kind text not null check (kind in ('browser_sdk', 'server_sdk', 'nextjs_sdk', 'http_check', 'webhook')),
  status text not null default 'pending' check (status in ('pending', 'verifying', 'verified', 'failing')),
  required boolean not null default true,
  checks jsonb not null default '[]'::jsonb check (jsonb_typeof(checks) = 'array'),
  last_event_at timestamptz,
  last_verified_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, organization_id) references public.projects (id, organization_id) on delete cascade,
  foreign key (environment_id, project_id) references public.environments (id, project_id) on delete cascade,
  unique (environment_id, kind)
);
create index project_connections_project_idx on public.project_connections (project_id);
create trigger project_connections_touch before update on public.project_connections
  for each row execute function app.touch_updated_at();

-- Telemetry credentials. Browser keys are public identifiers (no secret);
-- server secrets are stored only as an HMAC-SHA256 digest.
create table public.api_credentials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  environment_id uuid,
  kind text not null check (kind in ('browser_public', 'server_secret')),
  name text not null check (char_length(name) between 1 and 80),
  -- Displayable identifier, e.g. dh_pub_7Kq2… / dh_srv_9xYw…
  public_id text not null unique check (char_length(public_id) between 12 and 64),
  secret_hash text,
  scopes text[] not null default '{}' check (scopes <@ array['events:write', 'metrics:write', 'releases:write', 'deployments:write']),
  expires_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references public.users (id) on delete set null,
  rotated_from uuid references public.api_credentials (id) on delete set null,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (project_id, organization_id) references public.projects (id, organization_id) on delete cascade,
  foreign key (environment_id, project_id) references public.environments (id, project_id) on delete cascade,
  check ((kind = 'server_secret') = (secret_hash is not null))
);
create index api_credentials_project_idx on public.api_credentials (project_id) where revoked_at is null;

create trigger projects_audit after insert or update or delete on public.projects
  for each row execute function app.audit_row_change();
create trigger environments_audit after insert or update or delete on public.environments
  for each row execute function app.audit_row_change();
create trigger project_members_audit after insert or update or delete on public.project_members
  for each row execute function app.audit_row_change();
create trigger api_credentials_audit after insert or update or delete on public.api_credentials
  for each row execute function app.audit_row_change();

-- ---------------------------------------------------------------------------
-- RLS & grants
-- ---------------------------------------------------------------------------
alter table public.projects enable row level security;
alter table public.environments enable row level security;
alter table public.project_members enable row level security;
alter table public.project_connections enable row level security;
alter table public.api_credentials enable row level security;

revoke all on public.projects, public.environments, public.project_members,
  public.project_connections, public.api_credentials from anon, authenticated;

grant select on public.projects, public.environments, public.project_members, public.project_connections
  to authenticated;
-- Configuration columns only: status, timestamps and ownership stay server-managed.
grant update (name, framework, app_type, base_url, repository_url, hosting_provider, release_strategy, monitoring_config)
  on public.projects to authenticated;
grant update (name, base_url) on public.environments to authenticated;
-- secret_hash is never readable by clients.
grant select (id, organization_id, project_id, environment_id, kind, name, public_id, scopes, expires_at,
  last_used_at, revoked_at, revoked_by, rotated_from, created_by, created_at)
  on public.api_credentials to authenticated;

create policy projects_select on public.projects for select to authenticated
  using (organization_id in (select app.user_org_ids()));
create policy projects_update on public.projects for update to authenticated
  using (app.has_project_role(id, 'admin') and archived_at is null)
  with check (app.has_project_role(id, 'admin'));

create policy environments_select on public.environments for select to authenticated
  using (organization_id in (select app.user_org_ids()));
create policy environments_update on public.environments for update to authenticated
  using (app.has_project_role(project_id, 'admin')) with check (app.has_project_role(project_id, 'admin'));

create policy project_members_select on public.project_members for select to authenticated
  using (organization_id in (select app.user_org_ids()));

create policy project_connections_select on public.project_connections for select to authenticated
  using (organization_id in (select app.user_org_ids()));

create policy api_credentials_select on public.api_credentials for select to authenticated
  using (app.has_project_role(project_id, 'developer'));

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Creates a project with its environments atomically. Input shape mirrors
-- createProjectInputSchema in @devhub/contracts (snake_case keys).
create function public.create_project(p_organization_id uuid, p_project jsonb) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_project uuid;
  v_env jsonb;
begin
  if v_user is null or not app.has_org_role(p_organization_id, 'admin') then
    raise exception 'not allowed to create projects in this organization' using errcode = '42501';
  end if;
  if jsonb_typeof(p_project -> 'environments') <> 'array'
     or jsonb_array_length(p_project -> 'environments') not between 1 and 10 then
    raise exception 'between 1 and 10 environments are required' using errcode = '22023';
  end if;
  if not exists (
    select 1 from jsonb_array_elements(p_project -> 'environments') e where e ->> 'kind' = 'production'
  ) then
    raise exception 'a production environment is required' using errcode = '22023';
  end if;

  insert into public.projects (
    organization_id, name, slug, framework, app_type, base_url, repository_url,
    hosting_provider, release_strategy, monitoring_config, created_by)
  values (
    p_organization_id,
    btrim(p_project ->> 'name'),
    lower(btrim(p_project ->> 'slug')),
    p_project ->> 'framework',
    p_project ->> 'app_type',
    nullif(btrim(p_project ->> 'base_url'), ''),
    nullif(btrim(p_project ->> 'repository_url'), ''),
    p_project ->> 'hosting_provider',
    p_project ->> 'release_strategy',
    coalesce(p_project -> 'monitoring_config', '{}'::jsonb),
    v_user)
  returning id into v_project;

  for v_env in select * from jsonb_array_elements(p_project -> 'environments') loop
    insert into public.environments (organization_id, project_id, name, slug, kind, base_url)
    values (
      p_organization_id, v_project,
      btrim(v_env ->> 'name'), lower(btrim(v_env ->> 'slug')), v_env ->> 'kind',
      nullif(btrim(v_env ->> 'base_url'), ''));
  end loop;

  return v_project;
end
$$;

-- Archiving is destructive for monitoring: it needs the slug typed back as
-- confirmation, an admin role on the project, and AAL2 when MFA is required.
create function public.archive_project(p_project_id uuid, p_confirm_slug text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_project public.projects;
begin
  select * into v_project from public.projects where id = p_project_id;
  if v_project.id is null or not app.has_project_role(p_project_id, 'admin') then
    raise exception 'not allowed to archive this project' using errcode = '42501';
  end if;
  if not app.mfa_satisfied(v_project.organization_id) then
    raise exception 'two-factor verification required' using errcode = '42501';
  end if;
  if p_confirm_slug is distinct from v_project.slug then
    raise exception 'confirmation does not match the project slug' using errcode = '22023';
  end if;
  update public.projects set archived_at = now() where id = p_project_id and archived_at is null;
end
$$;

revoke all on function public.create_project(uuid, jsonb), public.archive_project(uuid, text) from public, anon;
grant execute on function public.create_project(uuid, jsonb), public.archive_project(uuid, text) to authenticated;
revoke all on function app.project_role(uuid), app.has_project_role(uuid, public.org_role) from public;
grant execute on function app.project_role(uuid), app.has_project_role(uuid, public.org_role) to authenticated;
grant all on all tables in schema public to service_role;
