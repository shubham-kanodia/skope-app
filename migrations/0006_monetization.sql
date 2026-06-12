-- Monetization: paid-plan lapse window, referral graph, team invites, and
-- usage-dunning dedupe. Consent-based limits themselves live in code
-- (lib/plans.ts); this migration only adds the columns/tables they need.

-- orgs: when a paid plan lapses, plan_active_until is in the past (entitlement
-- then falls through to free). Referral graph + Razorpay subscription handle.
alter table orgs add column if not exists plan_active_until        timestamptz;
alter table orgs add column if not exists referral_code            text;
alter table orgs add column if not exists referred_by_org_id       uuid references orgs(id) on delete set null;
alter table orgs add column if not exists razorpay_subscription_id text;

-- Give existing orgs a referral code, then enforce uniqueness.
update orgs set referral_code = substr(md5(random()::text || id::text), 1, 8)
 where referral_code is null;
create unique index if not exists orgs_referral_code_idx on orgs(referral_code);

-- The signup magic link can carry a referral code through to org creation.
alter table login_tokens add column if not exists ref_code text;

-- Team invites: a pending membership (role) in an org, with a hashed token
-- (only the SHA-256 hash is stored, same as login_tokens).
create table if not exists org_invites (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  email       text not null,
  role        user_role not null default 'viewer',
  token_hash  text not null unique,
  invited_by  uuid references users(id) on delete set null,
  expires_at  timestamptz not null,
  accepted_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists org_invites_org_idx on org_invites(org_id);
create index if not exists org_invites_email_idx on org_invites(email);

-- Referral audit + dedupe: at most one reward per referee org.
create table if not exists referrals (
  id              uuid primary key default gen_random_uuid(),
  referrer_org_id uuid not null references orgs(id) on delete cascade,
  referee_org_id  uuid not null references orgs(id) on delete cascade unique,
  reward_days     int not null default 30,
  created_at      timestamptz not null default now()
);
create index if not exists referrals_referrer_idx on referrals(referrer_org_id);

-- Usage dunning dedupe: at most one email per org per month per level.
create table if not exists usage_alerts (
  org_id  uuid not null references orgs(id) on delete cascade,
  month   char(7) not null,   -- 'YYYY-MM'
  level   text not null,      -- 'warn80' | 'over100' | 'lapsed'
  sent_at timestamptz not null default now(),
  primary key (org_id, month, level)
);
