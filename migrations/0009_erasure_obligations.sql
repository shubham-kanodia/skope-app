-- Erasure obligations (DPDP §8(7)-(8), §12(3)): when a principal withdraws, when
-- a purpose is no longer served (a prescribed period of principal inactivity,
-- §8(8)), or on an erasure request, the Data Fiduciary must erase the personal
-- data unless the law requires keeping it. The customer owns their datastore, so
-- Skope does NOT delete their data — it records the obligation with a due date,
-- surfaces it in an erasure-due queue, reminds, and evidences it in the audit
-- bundle. The fiduciary marks each obligation done (or "not required", with a
-- reason, when a legal hold applies).
do $$ begin
  create type erasure_kind as enum ('withdrawal','retention_lapsed','request','inactivity');
exception when duplicate_object then null; end $$;

do $$ begin
  create type erasure_status as enum ('open','in_progress','done','not_required');
exception when duplicate_object then null; end $$;

create table if not exists erasure_obligations (
  id              uuid primary key default gen_random_uuid(),
  site_id         uuid not null references sites(id) on delete cascade,
  subject_id      uuid,                         -- the principal, when known (ledger subject id)
  request_id      uuid references requests(id) on delete set null,
  kind            erasure_kind not null,
  source_action   text,                          -- e.g. 'withdraw_all', the consent action that opened it
  basis           text,                          -- human note on why it's due
  due_at          timestamptz not null,
  status          erasure_status not null default 'open',
  resolved_by     uuid references users(id) on delete set null,
  resolved_at     timestamptz,
  resolution_note text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists erasure_site_status_idx on erasure_obligations(site_id, status, due_at);

-- Idempotency for the sweep + withdrawal hook: one open obligation per
-- (site, subject, kind). Partial so request-sourced rows (no subject) don't clash.
create unique index if not exists erasure_subject_kind_ux
  on erasure_obligations(site_id, subject_id, kind)
  where subject_id is not null;
create unique index if not exists erasure_request_ux
  on erasure_obligations(request_id)
  where request_id is not null;
