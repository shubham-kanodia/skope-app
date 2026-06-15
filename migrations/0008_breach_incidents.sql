-- Personal data breach register (DPDP §8(6)): on a breach, the Data Fiduciary
-- must intimate the Data Protection Board and each affected Data Principal in
-- the prescribed form and manner. Skope holds only pseudonymous subjects, so we
-- record the incident, the categories and estimated count of affected people,
-- and the fact + timestamp of each notification — not the principals' raw PII.
-- The [HUMAN] prescribed form / Board channel is Rules-dependent; the notice
-- template carries flagged placeholders until those are notified.
do $$ begin
  create type breach_status as enum ('open','contained','board_notified','principals_notified','closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type breach_audience as enum ('board','principals');
exception when duplicate_object then null; end $$;

create table if not exists breach_incidents (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid not null references orgs(id) on delete cascade,
  site_id                uuid references sites(id) on delete set null,
  detected_at            timestamptz not null,
  nature                 text not null,                         -- what happened
  data_categories        text[] not null default '{}',          -- categories of data involved
  est_affected           int,                                   -- estimated count of affected principals
  remediation            text,                                  -- steps taken / planned
  status                 breach_status not null default 'open',
  board_notified_at      timestamptz,
  principals_notified_at timestamptz,
  created_by             uuid references users(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists breach_incidents_org_idx on breach_incidents(org_id, detected_at desc);

create table if not exists breach_notifications (
  id              uuid primary key default gen_random_uuid(),
  incident_id     uuid not null references breach_incidents(id) on delete cascade,
  audience        breach_audience not null,
  channel         text not null,                  -- e.g. 'email', 'board_portal'
  recipient_count int,                            -- how many principals (for audience='principals')
  payload         jsonb not null default '{}'::jsonb, -- snapshot of the notice text + subject sent
  sent_at         timestamptz not null default now()
);
create index if not exists breach_notifications_incident_idx on breach_notifications(incident_id, sent_at desc);
