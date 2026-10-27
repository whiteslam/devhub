-- DevHub HQ · 0600 · Products, plans and subscriptions (Phase 6).
--
-- Mirrors state from an external payment provider (e.g. Stripe). No card
-- data is ever stored; customers are referenced by provider identifiers.
-- Kept isolated from monitoring/deployment tables.

create table public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid,
  name text not null check (char_length(name) between 1 and 120),
  slug text not null check (app.is_valid_slug(slug)),
  provider text check (provider in ('stripe', 'lemonsqueezy', 'paddle')),
  provider_product_id text check (char_length(provider_product_id) <= 200),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, organization_id) references public.projects (id, organization_id) on delete set null (project_id),
  unique (organization_id, slug),
  unique (id, organization_id)
);
create trigger products_touch before update on public.products
  for each row execute function app.touch_updated_at();

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  product_id uuid not null,
  name text not null check (char_length(name) between 1 and 120),
  billing_interval text not null check (billing_interval in ('month', 'year', 'one_time')),
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  provider_price_id text check (char_length(provider_price_id) <= 200),
  entitlements jsonb not null default '{}'::jsonb check (jsonb_typeof(entitlements) = 'object'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (product_id, organization_id) references public.products (id, organization_id) on delete cascade,
  unique (id, organization_id)
);
create trigger plans_touch before update on public.plans
  for each row execute function app.touch_updated_at();

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  plan_id uuid not null,
  provider text not null check (provider in ('stripe', 'lemonsqueezy', 'paddle')),
  provider_subscription_id text not null check (char_length(provider_subscription_id) <= 200),
  provider_customer_id text not null check (char_length(provider_customer_id) <= 200),
  customer_label text check (char_length(customer_label) <= 200),
  status text not null check (status in ('trialing', 'active', 'past_due', 'paused', 'canceled', 'incomplete', 'unpaid')),
  current_period_end timestamptz,
  cancel_at timestamptz,
  -- Provider event time of the latest state; older webhook events are ignored.
  provider_updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (plan_id, organization_id) references public.plans (id, organization_id) on delete restrict,
  unique (provider, provider_subscription_id)
);
create index subscriptions_org_status_idx on public.subscriptions (organization_id, status);
create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function app.touch_updated_at();

create trigger products_audit after insert or update or delete on public.products
  for each row execute function app.audit_row_change();
create trigger plans_audit after insert or update or delete on public.plans
  for each row execute function app.audit_row_change();

alter table public.products enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;

revoke all on public.products, public.plans, public.subscriptions from anon, authenticated;
grant select on public.products, public.plans, public.subscriptions to authenticated;

create policy products_select on public.products for select to authenticated
  using (app.has_org_role(organization_id, 'owner'));
create policy plans_select on public.plans for select to authenticated
  using (app.has_org_role(organization_id, 'owner'));
create policy subscriptions_select on public.subscriptions for select to authenticated
  using (app.has_org_role(organization_id, 'owner'));

grant all on all tables in schema public to service_role;
