-- Personal data items a site declares it collects (DPDP §5: the notice must
-- itemize the personal data, not just cookies). Declared in the dashboard
-- (manually or suggested from a form screenshot), surfaced in the published
-- notice and the banner's manage view. Purposes are referenced by text key
-- (the live contract used by cfg, skope.js, and receipts), not the unused
-- purposes table.
do $$ begin create type data_item_category as enum ('identity','contact','financial','official_id','usage','other'); exception when duplicate_object then null; end $$;

create table if not exists data_items (
  id             uuid primary key default gen_random_uuid(),
  site_id        uuid not null references sites(id) on delete cascade,
  key            text not null,                       -- slug, e.g. 'email', 'pan'
  name_i18n      jsonb not null default '{}'::jsonb,  -- { en: "Email address", hi: ... }
  category       data_item_category not null default 'other',
  purpose_key    text not null default 'necessary',   -- cfg purpose key (necessary|analytics|marketing)
  source_label   text,                                 -- where it's collected, e.g. 'Signup form'
  retention_days int,
  position       int not null default 0,               -- display order
  created_at     timestamptz not null default now(),
  unique (site_id, key)
);
create index if not exists data_items_site_idx on data_items(site_id);
