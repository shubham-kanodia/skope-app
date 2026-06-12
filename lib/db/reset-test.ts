/**
 * Remove seed/test orgs and re-align founding_member_seq so real signups get
 * the correct founding numbers.
 *
 *   pnpm tsx lib/db/reset-test.ts
 *
 * Deletes only orgs created by the seed script (billing_email like
 * 'seed-%@example.test'); cascades to their users/sites/audit rows. Then sets
 * the sequence so the next nextval() is (max remaining founding_number)+1, or 1
 * if no founding orgs remain.
 */
import "./load-env";
import { sql } from "@/lib/db/client";

async function main() {
  // Wrap in a txn with the purge flag so the append-only ledger trigger permits
  // the cascade delete of any consent_receipts under these test orgs.
  const deleted = await sql.begin(async (tx) => {
    await tx`select set_config('skope.purge', 'on', true)`;
    return tx`
      delete from orgs
       where billing_email like 'seed-%@example.test'
          or billing_email like '%@acme.in'
      returning id`;
  });
  console.log(`Deleted ${deleted.length} seed org(s).`);

  const rows = await sql`select coalesce(max(founding_number), 0)::int as max from orgs`;
  const max = rows[0].max as number;
  if (max === 0) {
    await sql`select setval('founding_member_seq', 1, false)`;
    console.log("Reset founding_member_seq → next signup is #1.");
  } else {
    await sql`select setval('founding_member_seq', ${max}, true)`;
    console.log(`Aligned founding_member_seq → next signup is #${max + 1}.`);
  }

  await sql.end();
}

main().catch((err) => {
  console.error("\n✗ reset-test failed:", err.message ?? err);
  process.exit(1);
});
