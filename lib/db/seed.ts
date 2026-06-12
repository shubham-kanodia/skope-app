/**
 * Seed script for verifying entitlement allocation.
 *
 *   pnpm seed            # creates 51 test orgs
 *   pnpm seed 60         # creates N test orgs
 *
 * Proves the founding-member rule: the first 50 orgs get is_founding_member +
 * a 2-year comp window; #51+ get a 30-day trial. Idempotent-ish: each run uses
 * a fresh timestamped email prefix so re-running adds new orgs.
 */
import "./load-env";
import { findOrCreateUserByEmail } from "@/lib/orgs/users";
import { sql } from "@/lib/db/client";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url || url.includes("[YOUR-PASSWORD]")) {
    console.error(
      "\n✗ DATABASE_URL is missing or still has the [YOUR-PASSWORD] placeholder.\n" +
        "  Add your Supabase password to skope-app/.env, run `pnpm migrate`, then `pnpm seed`.\n",
    );
    process.exit(1);
  }

  const count = Number(process.argv[2] ?? 51);
  const stamp = Date.now().toString(36);
  console.log(`Seeding ${count} orgs…`);

  for (let i = 1; i <= count; i++) {
    await findOrCreateUserByEmail(`seed-${stamp}-${i}@example.test`);
  }

  const summary = await sql`
    select
      count(*) filter (where is_founding_member) as founding,
      count(*) filter (where not is_founding_member) as trial_only,
      max(founding_number) as max_founding_number
    from orgs`;

  console.log("\nAcross all orgs in the DB:");
  console.table(summary[0]);
  console.log(
    "Expected after a fresh DB seeded with 51: founding=50, trial_only=1, max_founding_number=50.",
  );

  await sql.end();
}

main().catch((err) => {
  console.error("\n✗ seed failed:", err.message ?? err);
  process.exit(1);
});
