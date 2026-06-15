-- Significant Data Fiduciary toolkit (DPDP §10). A fiduciary the Government
-- notifies as an SDF must appoint an India-based Data Protection Officer, engage
-- an independent data auditor, and carry out periodic Data Protection Impact
-- Assessments and audits. These tables hold the SDF designation + DPO
-- attestation, stored DPIAs, the auditor record, and the audit cadence with
-- reminders. Everything here is gated by the SDF flag, not by plan.
create table if not exists sdf_settings (
  org_id          uuid primary key references orgs(id) on delete cascade,
  is_sdf          boolean not null default false,
  dpo_india_based boolean not null default false,
  dpo_name        text,
  dpo_email       text,
  updated_at      timestamptz not null default now()
);

create table if not exists dpia_assessments (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  site_id     uuid references sites(id) on delete set null,
  title       text not null,
  content     jsonb not null default '{}'::jsonb,   -- structured DPIA answers
  status      text not null default 'draft',         -- 'draft' | 'final'
  created_by  uuid references users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists dpia_org_idx on dpia_assessments(org_id, created_at desc);

create table if not exists auditors (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  name        text not null,
  firm        text,
  contact_enc bytea,                                 -- AES-256-GCM via the org DEK
  engaged_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists auditors_org_idx on auditors(org_id);

create table if not exists audit_schedules (
  org_id            uuid primary key references orgs(id) on delete cascade,
  cadence_days      int not null default 365,
  next_due_at       timestamptz,
  last_completed_at timestamptz,
  last_reminded_at  timestamptz,
  updated_at        timestamptz not null default now()
);
