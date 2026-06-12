-- Public DPDP compliance checker: a scan + lead-capture record. Unauthenticated
-- visitors scan a site; we store the report and (when they ask for the full
-- report by email) their email as a lead.
create table if not exists compliance_scans (
  id           uuid primary key default gen_random_uuid(),
  report_token text not null unique,
  domain       text not null,
  scanned_url  text not null,
  score        int not null,
  report       jsonb not null default '{}'::jsonb,
  email        text,
  emailed_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists compliance_scans_domain_idx on compliance_scans(domain, created_at desc);
create index if not exists compliance_scans_email_idx on compliance_scans(email);
