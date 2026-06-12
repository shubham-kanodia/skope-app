-- Per-org data-encryption keys (DEKs), wrapped by the env master key (KEK).
-- Field-level PII (subjects.email_enc/phone_enc, requests.contact_enc) is
-- encrypted with the org's DEK. Deleting the wrapped DEK crypto-shreds every
-- encrypted field for that org — real, backup-proof erasure.
create table if not exists org_data_keys (
  org_id      uuid primary key references orgs(id) on delete cascade,
  wrapped_dek bytea not null,
  created_at  timestamptz not null default now()
);
