# Security posture

How Skope stores, encrypts, and proves consent data. This is the engineering
source of truth behind the public claims ("encrypted, stored in India,
deletable by design") — keep it accurate when touching anything listed here.

## Encryption at rest

Two-tier key hierarchy (`lib/encryption/`):

- **Master key (KEK)** — 32 bytes, base64, lives only in the
  `ENCRYPTION_MASTER_KEY` environment variable. Never in the database or
  backups.
- **Per-org data key (DEK)** — random 32 bytes per organisation, wrapped
  (AES-256-GCM) by the master key and stored in `org_data_keys.wrapped_dek`.
- **Field encryption** — AES-256-GCM with the org DEK. Blob layout:
  `iv(12) ‖ authTag(16) ‖ ciphertext`.

### What is encrypted

End-user (data principal) personal data is stored only in encrypted form:

| Column | Contents |
| --- | --- |
| `requests.contact_enc` | Requester's email |
| `requests.evidence.detailEnc` | Free-text request detail (base64 of the encrypted blob) |
| `subjects.email_enc`, `subjects.phone_enc` | Identified-visitor contacts (reserved; no writer yet) |

Legacy rows that stored `evidence.detail` in clear are migrated by
`pnpm tsx lib/db/backfill-encrypt-details.ts` (idempotent); the read path no
longer accepts plaintext details.

Consent receipts contain **no plaintext PII by design**: subject ids are
random UUIDs, IPs are truncated to /24 (IPv4) or /64 (IPv6) before storage,
and user agents are stored as truncated SHA-256 hashes
(`lib/consent/request-meta.ts`).

### What is deliberately not encrypted

Operational account data about our own customers (not their end users):
`users.email`, `orgs.billing_email`, `login_tokens.email` (the token itself is
stored only as a SHA-256 hash). These are needed for login lookups and
billing, are covered by the provider's disk-level encryption, and are not
"customer data" in the sense of the product claim.

## Crypto-shred deletion

Deleting an organisation (`lib/orgs/delete.ts`) deletes its wrapped DEK. Every
field encrypted under that DEK — including copies in database backups —
becomes unrecoverable. The append-only ledger trigger has a purge valve
(transaction-local `skope.purge` flag, `migrations/0003_ledger_purge_gate.sql`)
used only by this path.

## Tamper-evident ledger

`consent_receipts` is hash-chained per site
(`row_hash = SHA-256(prev_hash ‖ canonical_receipt)`, `lib/consent-core/hash-chain.ts`)
and append-only (DB trigger blocks UPDATE/DELETE). Anyone can anchor the chain
head via the public endpoint `GET /api/v1/ledger-head/:siteKey`. The audit
bundle re-runs full verification (`lib/consent/verify.ts`) and ships the
report.

## Data residency

Primary Postgres is Supabase `ap-south-1` (Mumbai). [HUMAN: keep the Upstash
Redis region verified against the "stored in India" claim — rate-limit keys
carry no PII, but verify before relying on it in marketing.]

## Exports

- CSV and audit-bundle downloads are session-authenticated, org-scoped, and
  every download writes an `audit_log` row (`export.receipts`,
  `export.requests`, `export.bundle`).
- **The requests CSV contains decrypted requester contacts** — that is its
  purpose (evidence of rights-request handling). Treat exported files as
  confidential; share only with auditors or regulators.
- Audit bundles include a `manifest.json` with the SHA-256 of every entry.

## Screenshot parsing

The data-items extractor (`lib/data-items/extract.ts`) holds the uploaded form
screenshot in request memory only: it is sent once to the vision model and
never written to disk, object storage, or the database.

## Review rules

- Never log emails, request details, decrypted fields, or raw tokens; log ids
  and error shapes instead.
- New PII columns must be encrypted with the org DEK (or justified here).
- Anything that decrypts data on the way out (exports, emails) must write an
  `audit_log` row.
