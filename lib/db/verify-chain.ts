/**
 * Verify consent-ledger integrity.
 *
 *   pnpm tsx lib/db/verify-chain.ts            # all sites
 *   pnpm tsx lib/db/verify-chain.ts <siteId>   # one site
 *
 * Re-derives each per-site hash chain from stored rows and checks it. This is
 * the same routine the nightly Inngest job will run (M7) to anchor head hashes.
 */
import "./load-env";
import { sql } from "@/lib/db/client";
import { verifySiteChain } from "@/lib/consent/verify";

async function main() {
  const only = process.argv[2];
  const sites = only
    ? [{ id: only }]
    : ((await sql`select id from sites order by created_at asc`) as Array<{ id: string }>);

  let allOk = true;
  for (const site of sites) {
    const res = await verifySiteChain(site.id);
    const status = res.ok ? "OK" : `BROKEN at seq ${res.brokenAt} (${res.reason})`;
    console.log(`site ${site.id}: ${res.count} receipt(s) → ${status}`);
    if (!res.ok) allOk = false;
  }

  await sql.end();
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error("\n✗ verify-chain failed:", err.message ?? err);
  process.exit(1);
});
