-- Retrospective notice to pre-existing principals (DPDP §5(2)). Where consent was
-- given before the Act commenced, the fiduciary must, as soon as practicable, give
-- the §5 notice. The banner only re-prompts returning visitors, so this is a
-- one-time broadcast to an imported existing-contact list, with per-recipient
-- delivery logged for the burden-of-proof record. Emails are encrypted at rest
-- with the org DEK; a sweep drains the queued rows through the email sender.
do $$ begin
  create type retro_delivery_status as enum ('queued','sent','failed','bounced');
exception when duplicate_object then null; end $$;

create table if not exists retro_notice_batches (
  id             uuid primary key default gen_random_uuid(),
  site_id        uuid not null references sites(id) on delete cascade,
  notice_version int,
  created_by     uuid references users(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists retro_batches_site_idx on retro_notice_batches(site_id, created_at desc);

create table if not exists retro_notice_recipients (
  id          uuid primary key default gen_random_uuid(),
  batch_id    uuid not null references retro_notice_batches(id) on delete cascade,
  email_enc   bytea not null,                        -- AES-256-GCM via the org DEK
  status      retro_delivery_status not null default 'queued',
  sent_at     timestamptz,
  error       text,
  created_at  timestamptz not null default now()
);
create index if not exists retro_recipients_batch_idx on retro_notice_recipients(batch_id);
create index if not exists retro_recipients_queued_idx on retro_notice_recipients(status) where status = 'queued';
