-- Nomination (DPDP §14): a Data Principal may nominate another individual to
-- exercise their rights in the event of death or incapacity. Today nomination is
-- only an intake request type with no stored nominee; this table holds the
-- structured nominee (name + contact encrypted with the org DEK) and an
-- activation workflow so a verified nominee can later act for the principal.
do $$ begin
  create type nomination_status as enum ('recorded','activated','revoked');
exception when duplicate_object then null; end $$;

create table if not exists nominations (
  id                  uuid primary key default gen_random_uuid(),
  site_id             uuid not null references sites(id) on delete cascade,
  subject_id          uuid,                          -- the principal, if known
  principal_ref       text,                          -- free label for the principal (e.g. account/email note)
  nominee_name_enc    bytea not null,
  nominee_contact_enc bytea,
  relationship        text,
  status              nomination_status not null default 'recorded',
  activated_at        timestamptz,
  evidence            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);
create index if not exists nominations_site_idx on nominations(site_id, created_at desc);
