import { sql } from "@/lib/db/client";

/**
 * Permanently delete an org and everything under it (sites, receipts, subjects,
 * requests, and the wrapped DEK, which crypto-shreds all encrypted PII).
 *
 * Sets the transaction-local `skope.purge` flag so the append-only ledger
 * trigger permits the cascade delete of consent_receipts. Used by account
 * deletion (M6) and by test cleanup.
 */
export async function purgeOrg(orgId: string): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`select set_config('skope.purge', 'on', true)`;
    await tx`delete from orgs where id = ${orgId}`;
  });
}
