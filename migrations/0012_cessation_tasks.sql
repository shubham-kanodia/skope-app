-- Processor-cease tasks (DPDP §6(6), §8(7)(b)): on withdrawal the fiduciary must,
-- within a reasonable time, cease processing and CAUSE its processors to cease
-- (and erase shared data). When a withdrawal opens an erasure obligation, Skope
-- fans out one cessation task per recipient: an integrated recipient (webhook_url
-- set) can be signalled automatically; others get a manual checklist item. The
-- task trail evidences when cessation was effected.
do $$ begin
  create type cessation_status as enum ('pending','signalled','acknowledged','manual_done');
exception when duplicate_object then null; end $$;

create table if not exists cessation_tasks (
  id            uuid primary key default gen_random_uuid(),
  obligation_id uuid not null references erasure_obligations(id) on delete cascade,
  recipient_id  uuid not null references recipients(id) on delete cascade,
  status        cessation_status not null default 'pending',
  signalled_at  timestamptz,
  ack_at        timestamptz,
  note          text,
  created_at    timestamptz not null default now(),
  unique (obligation_id, recipient_id)
);
create index if not exists cessation_obligation_idx on cessation_tasks(obligation_id);
