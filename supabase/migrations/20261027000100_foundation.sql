-- DevHub HQ · 0100 · Foundation: users, organizations, memberships, audit log.
--
-- Conventions used by every migration:
--   * UUID primary keys, timestamptz (UTC) timestamps.
--   * Every tenant-owned row carries organization_id; child rows also carry
--     project_id with a composite FK so a row can never point at another
--     tenant's project.
--   * RLS is enabled on every public table. Browser clients (anon /
--     authenticated) get explicit, minimal grants. Privileged writes go
--     through SECURITY DEFINER functions that check roles, or through the
--     server using the service role after server-side authorization.

create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to authenticated, service_role;

-- Ordered: comparisons such as role >= 'admin' follow declaration order.
create type public.org_role as enum ('viewer', 'developer', 'operator', 'admin', 'owner');
create type public.project_role as enum ('viewer', 'developer', 'operator', 'admin');

create function app.is_valid_slug(value text) returns boolean
language sql immutable
as $$ select value ~ '^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){1,47}$' $$;

create function app.touch_updated_at() returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

-- ---------------------------------------------------------------------------
-- users: profile mirror of auth.users (no passwords, no auth secrets)
-- ---------------------------------------------------------------------------
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text check (char_length(display_name) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger users_touch before update on public.users
  for each row execute function app.touch_updated_at();

create function app.sync_auth_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.users (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 120), '')
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end
$$;
create trigger on_auth_user_changed
  after insert or update of email on auth.users
  for each row execute function app.sync_auth_user();

-- ---------------------------------------------------------------------------
-- organizations & memberships
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  slug text not null unique check (app.is_valid_slug(slug)),
  -- Require a second factor (AAL2) for sensitive and operational actions.
  require_mfa boolean not null default false,
  -- Raw telemetry retention; see 0700_retention.sql.
  telemetry_retention_days integer not null default 30 check (telemetry_retention_days between 1 and 400),
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger organizations_touch before update on public.organizations
  for each row execute function app.touch_updated_at();

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role public.org_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index memberships_user_idx on public.memberships (user_id, organization_id);
create trigger memberships_touch before update on public.memberships
  for each row execute function app.touch_updated_at();

-- An organization must always keep at least one owner.
create function app.keep_one_owner() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid := old.organization_id;
begin
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner')
     and exists (select 1 from public.organizations o where o.id = v_org)
     and not exists (
       select 1 from public.memberships m
       where m.organization_id = v_org and m.role = 'owner' and m.id <> old.id
     ) then
    raise exception 'an organization must keep at least one owner' using errcode = '23514';
  end if;
  return coalesce(new, old);
end
$$;
create trigger memberships_keep_owner
  before update of role or delete on public.memberships
  for each row execute function app.keep_one_owner();

-- ---------------------------------------------------------------------------
-- Authorization helpers. SECURITY DEFINER so policies can consult
-- memberships without recursive RLS evaluation. They only ever answer
-- questions about the calling user (auth.uid()).
--
-- Assurance level (MFA) is enforced HERE, centrally: every data policy and
-- RPC goes through user_org_ids() / org_role(), which grant nothing to a
-- session below the required level. The required level is AAL2 when the user
-- has a verified factor (a stolen password alone opens nothing) or when the
-- organization requires MFA. The JWT `aal` claim is signed by Supabase Auth.
-- ---------------------------------------------------------------------------

-- Memberships regardless of assurance level: only for showing the user which
-- organizations exist and that a step-up is needed. Grants no data access.
create function app.member_org_ids() returns setof uuid
language sql stable security definer set search_path = ''
as $$ select m.organization_id from public.memberships m where m.user_id = auth.uid() $$;

-- aal_satisfied() reads auth.mfa_factors with the migration role's rights.
-- Fail the migration now if that role cannot, instead of failing every RLS
-- check at runtime (which would lock all users out).
do $$
begin
  perform 1 from auth.mfa_factors limit 1;
exception when insufficient_privilege then
  raise exception 'migration role % cannot read auth.mfa_factors; grant select on auth.mfa_factors to it', current_user;
end
$$;

create function app.aal_satisfied(p_org uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or (
        not exists (
          select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status::text = 'verified')
        and not coalesce((select o.require_mfa from public.organizations o where o.id = p_org), false)
      )
$$;

create function app.user_org_ids() returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select m.organization_id from public.memberships m
  where m.user_id = auth.uid() and app.aal_satisfied(m.organization_id)
$$;

create function app.org_role(p_org uuid) returns public.org_role
language sql stable security definer set search_path = ''
as $$
  select m.role from public.memberships m
  where m.organization_id = p_org and m.user_id = auth.uid() and app.aal_satisfied(p_org)
$$;

create function app.has_org_role(p_org uuid, p_min public.org_role) returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(app.org_role(p_org) >= p_min, false) $$;

-- AAL2 is satisfied, or the organization does not require MFA.
create function app.mfa_satisfied(p_org uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select not o.require_mfa or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
     from public.organizations o where o.id = p_org),
    false)
$$;

-- ---------------------------------------------------------------------------
-- audit_logs: append-only. Written by triggers and SECURITY DEFINER
-- functions, never directly by clients.
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid,
  actor_id uuid references public.users (id) on delete set null,
  actor_type text not null check (actor_type in ('user', 'system', 'api_credential')),
  action text not null check (char_length(action) <= 120),
  target_table text,
  target_id uuid,
  changes jsonb not null default '{}'::jsonb,
  request_id text,
  created_at timestamptz not null default now()
);
create index audit_logs_org_created_idx on public.audit_logs (organization_id, created_at desc, id desc);
create index audit_logs_target_idx on public.audit_logs (target_table, target_id);

-- Keys that must never be copied into the audit trail.
create function app.redact_audit(doc jsonb) returns jsonb
language sql immutable
as $$
  select coalesce(doc, '{}'::jsonb)
    - 'secret_hash' - 'credentials_ciphertext' - 'payload' - 'updated_at'
$$;

create function app.request_id() returns text
language sql stable
as $$
  select left(nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-request-id', 100)
$$;

create function app.write_audit(
  p_org uuid, p_project uuid, p_action text, p_table text, p_target uuid, p_changes jsonb
) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.organizations o where o.id = p_org) then
    return; -- organization is being deleted; its audit trail goes with it
  end if;
  insert into public.audit_logs (organization_id, project_id, actor_id, actor_type, action, target_table, target_id, changes, request_id)
  values (
    p_org, p_project, auth.uid(),
    case when auth.uid() is null then 'system' else 'user' end,
    p_action, p_table, p_target, coalesce(p_changes, '{}'::jsonb), app.request_id()
  );
end
$$;

-- Generic row-change auditor. Records only changed keys on UPDATE.
create function app.audit_row_change() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_new jsonb := case when tg_op <> 'DELETE' then app.redact_audit(to_jsonb(new)) end;
  v_old jsonb := case when tg_op <> 'INSERT' then app.redact_audit(to_jsonb(old)) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_org uuid;
  v_changes jsonb;
begin
  v_org := case when tg_table_name = 'organizations' then (v_row ->> 'id')::uuid
                else (v_row ->> 'organization_id')::uuid end;
  if tg_op = 'UPDATE' then
    select coalesce(jsonb_object_agg(k, jsonb_build_object('from', v_old -> k, 'to', v_new -> k)), '{}'::jsonb)
      into v_changes
      from jsonb_object_keys(v_new) as k
      where v_new -> k is distinct from v_old -> k;
    if v_changes = '{}'::jsonb then
      return new;
    end if;
  else
    v_changes := v_row;
  end if;
  perform app.write_audit(
    v_org,
    case when tg_table_name = 'projects' then (v_row ->> 'id')::uuid else (v_row ->> 'project_id')::uuid end,
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    (v_row ->> 'id')::uuid,
    v_changes
  );
  return coalesce(new, old);
end
$$;

create function app.protect_audit_logs() returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' and (
       current_setting('app.allow_audit_prune', true) = 'on'
       or not exists (select 1 from public.organizations o where o.id = old.organization_id)
     ) then
    return old;
  end if;
  raise exception 'audit_logs is append-only' using errcode = '42501';
end
$$;
create trigger audit_logs_immutable before update or delete on public.audit_logs
  for each row execute function app.protect_audit_logs();

create trigger organizations_audit after insert or update on public.organizations
  for each row execute function app.audit_row_change();
create trigger memberships_audit after insert or update or delete on public.memberships
  for each row execute function app.audit_row_change();

-- ---------------------------------------------------------------------------
-- RLS & grants
-- ---------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.audit_logs enable row level security;

revoke all on public.users, public.organizations, public.memberships, public.audit_logs from anon, authenticated;
grant select on public.users, public.organizations, public.memberships, public.audit_logs to authenticated;
grant update (display_name) on public.users to authenticated;
grant update (name) on public.organizations to authenticated;

-- Users see themselves and people who share an organization with them.
create policy users_select on public.users for select to authenticated
  using (
    id = (select auth.uid())
    or id in (select m.user_id from public.memberships m where m.organization_id in (select app.user_org_ids()))
  );
create policy users_update_self on public.users for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Organization metadata (name, slug, policy) stays visible below the required
-- assurance level so the dashboard can explain the step-up; it holds no secrets.
create policy organizations_select on public.organizations for select to authenticated
  using (id in (select app.member_org_ids()));
create policy organizations_update on public.organizations for update to authenticated
  using (app.has_org_role(id, 'admin')) with check (app.has_org_role(id, 'admin'));

create policy memberships_select on public.memberships for select to authenticated
  using (user_id = (select auth.uid()) or organization_id in (select app.user_org_ids()));

create policy audit_logs_select on public.audit_logs for select to authenticated
  using (app.has_org_role(organization_id, 'admin'));

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
create function public.create_organization(p_name text, p_slug text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_org uuid;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if (select count(*) from public.memberships m where m.user_id = v_user and m.role = 'owner') >= 5 then
    raise exception 'organization limit reached' using errcode = '54000';
  end if;
  insert into public.organizations (name, slug, created_by)
  values (btrim(p_name), lower(btrim(p_slug)), v_user)
  returning id into v_org;
  insert into public.memberships (organization_id, user_id, role) values (v_org, v_user, 'owner');
  return v_org;
end
$$;

-- Security settings are owner-only, and relaxing them needs AAL2 when MFA is required.
create function public.update_organization_security(
  p_org uuid, p_require_mfa boolean, p_retention_days integer
) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not app.has_org_role(p_org, 'owner') then
    raise exception 'only owners can change security settings' using errcode = '42501';
  end if;
  if not app.mfa_satisfied(p_org) then
    raise exception 'two-factor verification required' using errcode = '42501';
  end if;
  update public.organizations
     set require_mfa = p_require_mfa, telemetry_retention_days = p_retention_days
   where id = p_org;
end
$$;

revoke all on function public.create_organization(text, text) from public, anon;
revoke all on function public.update_organization_security(uuid, boolean, integer) from public, anon;
grant execute on function public.create_organization(text, text) to authenticated;
grant execute on function public.update_organization_security(uuid, boolean, integer) to authenticated;

revoke all on all functions in schema app from public;
grant execute on function app.user_org_ids(), app.member_org_ids(), app.aal_satisfied(uuid), app.org_role(uuid),
  app.has_org_role(uuid, public.org_role), app.mfa_satisfied(uuid), app.is_valid_slug(text) to authenticated;
grant all on all tables in schema public to service_role;
