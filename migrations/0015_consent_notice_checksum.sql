-- Consent-proof hardening (DPDP §6(10)): pin the checksum of the exact published
-- notice shown at consent time onto each receipt, so the precise notice text is
-- self-contained and independently verifiable without joining back to notices.
-- The column is nullable; existing rows stay null and their hashes are unchanged
-- (the checksum is folded into the hash only when present).
alter table consent_receipts add column if not exists notice_checksum text;
