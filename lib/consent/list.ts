import { sql } from "@/lib/db/client";

export interface ReceiptRow {
  occurred_at: string;
  action: string;
  purposes_granted: string[];
  purposes_denied: string[];
  region: string | null;
  method: string;
  language_shown: string | null;
  seq: number;
  domain: string;
}

/** Recent consent receipts across all of an org's sites, newest first. */
export async function listReceiptsForOrg(orgId: string, limit = 100): Promise<ReceiptRow[]> {
  const rows = await sql`
    select r.occurred_at, r.action, r.purposes_granted, r.purposes_denied,
           r.region, r.method, r.language_shown, r.seq, s.domain
    from consent_receipts r
    join sites s on s.id = r.site_id
    where s.org_id = ${orgId}
    order by r.occurred_at desc
    limit ${limit}`;
  return rows as unknown as ReceiptRow[];
}

export interface ExportReceiptRow extends ReceiptRow {
  id: string;
  notice_version: number | null;
  row_hash_hex: string;
  site_id: string;
}

export interface ExportCursor {
  occurredAt: string;
  id: string;
}

/**
 * One keyset-paginated batch of receipts for CSV/bundle export, newest first.
 * Keyset (not OFFSET, not postgres.js cursors — the transaction pooler can't
 * hold portals) keeps memory bounded however large the ledger gets.
 */
export async function listReceiptsForExport(
  orgId: string,
  opts: { siteId?: string; after?: ExportCursor | null } = {},
  batch = 1000,
): Promise<ExportReceiptRow[]> {
  const siteFilter = opts.siteId ? sql`and r.site_id = ${opts.siteId}` : sql``;
  const cursor = opts.after
    ? sql`and (r.occurred_at, r.id) < (${opts.after.occurredAt}, ${opts.after.id})`
    : sql``;
  const rows = await sql`
    select r.id, r.site_id, r.occurred_at, r.action, r.purposes_granted, r.purposes_denied,
           r.region, r.method, r.language_shown, r.seq, r.notice_version,
           encode(r.row_hash, 'hex') as row_hash_hex, s.domain
    from consent_receipts r
    join sites s on s.id = r.site_id
    where s.org_id = ${orgId} ${siteFilter} ${cursor}
    order by r.occurred_at desc, r.id desc
    limit ${batch}`;
  return rows as unknown as ExportReceiptRow[];
}

export async function countReceiptsForOrg(orgId: string): Promise<number> {
  const rows = await sql`
    select count(*)::int as n from consent_receipts r
    join sites s on s.id = r.site_id where s.org_id = ${orgId}`;
  return (rows[0]?.n as number) ?? 0;
}
