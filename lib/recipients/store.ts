import { sql } from "@/lib/db/client";
import type { Recipient, RecipientInput, RecipientRole, ContractStatus } from "./types";

function mapRow(r: Record<string, unknown>): Recipient {
  return {
    id: r.id as string,
    name: r.name as string,
    role: r.role as RecipientRole,
    purpose: (r.purpose as string | null) ?? null,
    dataItemKeys: (r.data_item_keys as string[] | null) ?? [],
    country: (r.country as string | null) ?? null,
    contractRef: (r.contract_ref as string | null) ?? null,
    contractStatus: (r.contract_status as ContractStatus | null) ?? null,
    webhookUrl: (r.webhook_url as string | null) ?? null,
    position: r.position as number,
  };
}

export async function listRecipients(siteId: string): Promise<Recipient[]> {
  const rows = await sql`
    select id, name, role, purpose, data_item_keys, country, contract_ref, contract_status,
           webhook_url, position
    from recipients where site_id = ${siteId}
    order by position asc, created_at asc`;
  return (rows as unknown as Record<string, unknown>[]).map(mapRow);
}

export interface RecipientWithSite extends Recipient {
  siteId: string;
  domain: string;
}

/** Every recipient across an org's sites, for the org-wide view, notice, and bundle. */
export async function listRecipientsForOrg(orgId: string): Promise<RecipientWithSite[]> {
  const rows = await sql`
    select r.id, r.site_id, r.name, r.role, r.purpose, r.data_item_keys, r.country,
           r.contract_ref, r.contract_status, r.webhook_url, r.position, s.domain
    from recipients r join sites s on s.id = r.site_id
    where s.org_id = ${orgId}
    order by s.domain asc, r.position asc`;
  return (rows as unknown as Record<string, unknown>[]).map((r) => ({
    ...mapRow(r),
    siteId: r.site_id as string,
    domain: r.domain as string,
  }));
}

/** Replace the site's recipient register in one transaction (small list). */
export async function replaceRecipients(siteId: string, recipients: RecipientInput[]): Promise<number> {
  await sql.begin(async (tx) => {
    await tx`delete from recipients where site_id = ${siteId}`;
    for (let i = 0; i < recipients.length; i++) {
      const r = recipients[i];
      await tx`
        insert into recipients
          (site_id, name, role, purpose, data_item_keys, country, contract_ref, contract_status, webhook_url, position)
        values
          (${siteId}, ${r.name}, ${r.role}, ${r.purpose}, ${r.dataItemKeys}, ${r.country},
           ${r.contractRef}, ${r.contractStatus}, ${r.webhookUrl}, ${i})`;
    }
  });
  return recipients.length;
}
