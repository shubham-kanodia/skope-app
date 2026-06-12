-- skope-app initial schema (implementation-plan B2, implemented exactly + trial/founding fields).
-- Idempotent: safe to re-run. Enums guarded with DO blocks; tables use IF NOT EXISTS.

create extension if not exists pgcrypto;

-- ---------- enums ----------
do $$ begin create type user_role        as enum ('owner','admin','viewer'); exception when duplicate_object then null; end $$;
do $$ begin create type org_plan         as enum ('free','starter','growth','scale'); exception when duplicate_object then null; end $$;
do $$ begin create type geo_mode         as enum ('india_only','global','custom'); exception when duplicate_object then null; end $$;
do $$ begin create type site_status      as enum ('active','paused','archived'); exception when duplicate_object then null; end $$;
do $$ begin create type purpose_category as enum ('necessary','functional','analytics','marketing','custom'); exception when duplicate_object then null; end $$;
do $$ begin create type tracker_status   as enum ('blocked_until_consent','always','disabled'); exception when duplicate_object then null; end $$;
do $$ begin create type consent_action   as enum ('grant','deny','update','withdraw','withdraw_all'); exception when duplicate_object then null; end $$;
do $$ begin create type consent_method   as enum ('banner','preference_center','form','api'); exception when duplicate_object then null; end $$;
do $$ begin create type request_type     as enum ('access','correction','erasure','grievance','nomination'); exception when duplicate_object then null; end $$;
do $$ begin create type request_status   as enum ('new','verifying','in_progress','done','rejected'); exception when duplicate_object then null; end $$;
do $$ begin create type api_scope        as enum ('read','write'); exception when duplicate_object then null; end $$;

-- First-50 founding-member allocation. nextval() inside the signup txn is race-free.
create sequence if not exists founding_member_seq;

-- ---------- core tenancy ----------
create table if not exists orgs (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  billing_email       text,
  plan                org_plan not null default 'free',
  razorpay_customer_id text,
  -- trial + founding-member entitlement (read by lib/entitlement)
  trial_ends_at       timestamptz,
  is_founding_member  boolean not null default false,
  founding_number     int,                 -- their 1..50 slot, null if not founding
  comp_until          timestamptz,         -- founding members: free compliance until this date
  created_at          timestamptz not null default now()
);

create table if not exists users (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  email       text not null,
  name        text,
  role        user_role not null default 'owner',
  created_at  timestamptz not null default now(),
  unique (email)
);
create index if not exists users_org_idx on users(org_id);

create table if not exists sites (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references orgs(id) on delete cascade,
  domain           text not null,
  site_key         text not null unique,
  status           site_status not null default 'active',
  geo_mode         geo_mode not null default 'india_only',
  default_language text not null default 'en',
  enabled_languages text[] not null default array['en','hi'],
  settings         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);
create index if not exists sites_org_idx on sites(org_id);

-- ---------- consent config ----------
create table if not exists purposes (
  id            uuid primary key default gen_random_uuid(),
  site_id       uuid not null references sites(id) on delete cascade,
  key           text not null,
  name_i18n     jsonb not null default '{}'::jsonb,
  description_i18n jsonb not null default '{}'::jsonb,
  category      purpose_category not null default 'custom',
  is_essential  boolean not null default false,
  retention_days int,
  version       int not null default 1,
  status        text not null default 'active',
  created_at    timestamptz not null default now(),
  unique (site_id, key)
);

create table if not exists notices (
  id           uuid primary key default gen_random_uuid(),
  site_id      uuid not null references sites(id) on delete cascade,
  version      int not null,
  content_i18n jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  checksum     text,
  created_at   timestamptz not null default now(),
  unique (site_id, version)
);

create table if not exists trackers (
  id            uuid primary key default gen_random_uuid(),
  site_id       uuid not null references sites(id) on delete cascade,
  detected_name text not null,
  vendor        text,
  category      purpose_category,
  purpose_id    uuid references purposes(id) on delete set null,
  script_pattern text,
  cookie_names  text[] not null default '{}',
  status        tracker_status not null default 'blocked_until_consent',
  first_seen    timestamptz not null default now(),
  last_seen     timestamptz not null default now()
);
create index if not exists trackers_site_idx on trackers(site_id);

-- ---------- subjects (vault-ready, PII encrypted) ----------
create table if not exists subjects (
  id           uuid primary key default gen_random_uuid(),
  site_id      uuid not null references sites(id) on delete cascade,
  external_ref text,
  email_enc    bytea,   -- AES-256-GCM via lib/encryption; null until identified
  phone_enc    bytea,
  data_key_wrapped bytea, -- per-subject? no: per-org key lives elsewhere; reserved
  created_at   timestamptz not null default now(),
  erased_at    timestamptz
);
create index if not exists subjects_site_idx on subjects(site_id);

-- ---------- the ledger (append-only, hash-chained per site) ----------
create table if not exists consent_receipts (
  id              uuid primary key default gen_random_uuid(),
  site_id         uuid not null references sites(id) on delete cascade,
  subject_id      uuid,                  -- random anon id or links to subjects.id
  purposes_granted text[] not null default '{}',
  purposes_denied  text[] not null default '{}',
  action          consent_action not null,
  notice_version  int,
  language_shown  text,
  region          char(2),
  method          consent_method not null,
  form_id         text,
  user_agent_hash text,
  ip_truncated    text,                  -- /24 truncation, never the full IP
  occurred_at     timestamptz not null default now(),
  seq             bigint not null,       -- per-site monotonic position in the chain
  prev_hash       bytea,
  row_hash        bytea not null,
  unique (site_id, seq)
);
create index if not exists receipts_site_time_idx on consent_receipts(site_id, occurred_at desc);
create index if not exists receipts_subject_idx on consent_receipts(site_id, subject_id);

-- Append-only enforcement: block UPDATE/DELETE on the ledger. Corrections are new rows.
create or replace function skope_block_mutation() returns trigger as $$
begin
  raise exception 'consent_receipts is append-only; corrections must be new rows';
end;
$$ language plpgsql;
drop trigger if exists receipts_no_update on consent_receipts;
create trigger receipts_no_update before update or delete on consent_receipts
  for each row execute function skope_block_mutation();

-- ---------- DPDP requests ----------
create table if not exists requests (
  id              uuid primary key default gen_random_uuid(),
  site_id         uuid not null references sites(id) on delete cascade,
  contact_enc     bytea,
  type            request_type not null,
  status          request_status not null default 'new',
  due_at          timestamptz,
  verification_token text,
  resolution_note text,
  completed_at    timestamptz,
  evidence        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists requests_site_idx on requests(site_id, status);

-- ---------- ops ----------
create table if not exists scan_runs (
  id          uuid primary key default gen_random_uuid(),
  site_id     uuid not null references sites(id) on delete cascade,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  findings    jsonb not null default '{}'::jsonb
);

create table if not exists audit_log (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid references orgs(id) on delete cascade,
  actor_user_id uuid references users(id) on delete set null,
  action        text not null,
  target        text,
  diff          jsonb,
  at            timestamptz not null default now()
);
create index if not exists audit_org_idx on audit_log(org_id, at desc);

create table if not exists api_keys (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  scope       api_scope not null default 'read',
  hashed_key  text not null,
  last_used_at timestamptz,
  created_at  timestamptz not null default now()
);

create table if not exists usage_counters (
  site_id        uuid not null references sites(id) on delete cascade,
  month          char(7) not null,        -- 'YYYY-MM'
  consent_events int not null default 0,
  primary key (site_id, month)
);

-- ---------- auth: magic links ----------
create table if not exists login_tokens (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  token_hash  text not null unique,
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists login_tokens_email_idx on login_tokens(email);
