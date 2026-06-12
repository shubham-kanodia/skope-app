/**
 * One-time backfill: encrypt legacy plaintext request details.
 *
 *   pnpm tsx lib/db/backfill-encrypt-details.ts
 *
 * Early requests stored the free-text detail in clear at evidence.detail;
 * newer rows encrypt it with the org DEK into evidence.detailEnc (see
 * lib/requests/store.ts). This encrypts every remaining plaintext detail and
 * strips the clear copy, making "end-user data is stored only encrypted" true
 * for historical rows too. Idempotent: rows without evidence.detail are
 * untouched.
 */
import "./load-env";
import { sql } from "@/lib/db/client";
import { encryptField } from "@/lib/encryption";

async function main() {
  const rows = (await sql`
    select r.id, r.evidence, s.org_id
    from requests r join sites s on s.id = r.site_id
    where r.evidence ? 'detail'`) as Array<{
    id: string;
    evidence: Record<string, unknown>;
    org_id: string;
  }>;

  if (rows.length === 0) {
    console.log("No plaintext details found, nothing to do.");
    await sql.end();
    return;
  }

  let done = 0;
  for (const row of rows) {
    const { detail, ...rest } = row.evidence as { detail?: unknown };
    const text = typeof detail === "string" ? detail.slice(0, 4000) : "";
    const detailEnc = text ? (await encryptField(row.org_id, text)).toString("base64") : null;
    // Keep an existing detailEnc if one is somehow present; otherwise use ours.
    const evidence = { ...rest, detailEnc: (rest as { detailEnc?: string }).detailEnc ?? detailEnc };
    await sql`update requests set evidence = ${sql.json(JSON.parse(JSON.stringify(evidence)))} where id = ${row.id}`;
    done++;
  }

  console.log(`Encrypted and stripped plaintext detail on ${done} request(s).`);
  await sql.end();
}

main().catch((err) => {
  console.error("\n✗ backfill failed:", err.message ?? err);
  process.exit(1);
});
