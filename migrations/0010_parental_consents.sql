-- Verifiable parental/guardian consent for a child's data (DPDP §9(1)). When a
-- site runs child mode and a visitor signals they are under 18, the banner
-- routes to a parental-consent capture flow: the guardian's contact is recorded
-- (encrypted with the org DEK, like a request's contact), a verification link is
-- emailed, and on confirmation a 'parental_grant' receipt is appended to the
-- consent ledger as a distinct action. Until then, only essential processing
-- happens (non-essential trackers stay blocked).
--
-- [HUMAN] The DPDP Rules have not prescribed a single "verifiable" mechanism.
-- The method is pluggable (method column); the interim default is guardian email
-- + an explicit declaration. Counsel should confirm the mechanism, and it can be
-- upgraded (DigiLocker / payment verification) without a schema change.

-- The ledger records parental consent as its own action so proof is self-evident.
-- (PG15 allows ADD VALUE inside a transaction; the value is only used at runtime.)
alter type consent_action add value if not exists 'parental_grant';
alter type consent_action add value if not exists 'parental_withdraw';

create table if not exists parental_consents (
  id                   uuid primary key default gen_random_uuid(),
  site_id              uuid not null references sites(id) on delete cascade,
  subject_id           uuid not null,                 -- the child's ledger subject id
  guardian_contact_enc bytea not null,                -- AES-256-GCM via the org DEK
  method               text not null default 'email_declaration',
  status               text not null default 'pending', -- 'pending' | 'verified' | 'revoked'
  token_hash           text not null,                 -- sha256 of the verification token
  purposes             text[] not null default '{}',  -- non-essential purposes the guardian may grant
  verified_at          timestamptz,
  created_at           timestamptz not null default now()
);
create index if not exists parental_consents_site_idx on parental_consents(site_id, created_at desc);
create index if not exists parental_consents_token_idx on parental_consents(token_hash);
