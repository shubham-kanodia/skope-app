-- Recipients / Data Processor register (DPDP §5, §8(2), §11(1)(b)). On an access
-- request, the fiduciary must disclose the identities of every other Data
-- Fiduciary and Data Processor the data was shared with, plus a description of
-- what was shared. This register is the structured source for that disclosure,
-- the privacy notice's "who we share with" section, and (for processors) the
-- §8(2) contract record. The country column feeds §16 cross-border disclosure,
-- and webhook_url feeds the §6(6) processor-cease signal.
do $$ begin
  create type recipient_role as enum ('fiduciary','processor');
exception when duplicate_object then null; end $$;

create table if not exists recipients (
  id              uuid primary key default gen_random_uuid(),
  site_id         uuid not null references sites(id) on delete cascade,
  name            text not null,
  role            recipient_role not null default 'processor',
  purpose         text,                              -- why this recipient gets the data
  data_item_keys  text[] not null default '{}',      -- references data_items.key
  country         char(2),                           -- ISO-3166 alpha-2, for §16 transfers
  contract_ref    text,                              -- §8(2) DPA reference (processors)
  contract_status text,                              -- e.g. 'signed','pending','none'
  webhook_url     text,                              -- optional §6(6) cease endpoint
  position        int not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists recipients_site_idx on recipients(site_id);
