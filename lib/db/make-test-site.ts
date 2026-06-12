/**
 * Create a throwaway org + site for live API testing. Prints SITE_KEY / SITE_ID.
 * Uses an @acme.in email so `reset-test.ts` cleans it up afterwards.
 *
 *   pnpm tsx lib/db/make-test-site.ts
 */
import "./load-env";
import { findOrCreateUserByEmail } from "@/lib/orgs/users";
import { createSite } from "@/lib/orgs/queries";
import { sql } from "@/lib/db/client";

async function main() {
  const { orgId, userId } = await findOrCreateUserByEmail("consent-e2e@acme.in");
  const site = await createSite(orgId, userId, "consent-e2e.example.in");
  console.log(`SITE_KEY=${site.site_key}`);
  console.log(`SITE_ID=${site.id}`);
  await sql.end();
}

main().catch((err) => {
  console.error("make-test-site failed:", err.message ?? err);
  process.exit(1);
});
