-- Minimal stand-in for the pieces of a Supabase project that DevHub's
-- migrations depend on: the API roles, the auth schema, and the JWT helpers.
-- Semantics follow Supabase: claims come from the request.jwt.claims GUC
-- that PostgREST sets per request. Used only by tests and db:check.
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table auth.mfa_factors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  factor_type text not null default 'totp',
  status text not null check (status in ('unverified', 'verified')),
  created_at timestamptz not null default now()
);

create function auth.jwt() returns jsonb
language sql stable
as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;

create function auth.uid() returns uuid
language sql stable
as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;

grant execute on function auth.jwt(), auth.uid() to anon, authenticated, service_role;
