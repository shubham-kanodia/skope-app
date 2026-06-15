import { sql } from "@/lib/db/client";
import { verifyChain, type ChainLink, type ChainVerification } from "@/lib/consent-core/hash-chain";

/** Re-derive a site's chain from stored rows and verify it end-to-end. */
export async function verifySiteChain(siteId: string): Promise<ChainVerification & { count: number }> {
  const rows = await sql`
    select subject_id, action, purposes_granted, purposes_denied, notice_version, notice_checksum,
           language_shown, region, method, form_id, occurred_at, seq, prev_hash, row_hash
    from consent_receipts where site_id = ${siteId} order by seq asc`;

  const links: ChainLink[] = rows.map((r) => ({
    siteId,
    subjectId: r.subject_id as string,
    action: r.action,
    purposesGranted: (r.purposes_granted ?? []) as string[],
    purposesDenied: (r.purposes_denied ?? []) as string[],
    noticeVersion: r.notice_version === null ? null : Number(r.notice_version),
    noticeChecksum: (r.notice_checksum as string | null) ?? null,
    languageShown: (r.language_shown as string | null) ?? null,
    region: (r.region as string | null) ?? null,
    method: r.method,
    formId: (r.form_id as string | null) ?? null,
    occurredAt: new Date(r.occurred_at).toISOString(),
    seq: Number(r.seq),
    prevHash: r.prev_hash ? toBuffer(r.prev_hash) : null,
    rowHash: toBuffer(r.row_hash),
  }));

  return { ...verifyChain(links), count: links.length };
}

/** The latest head hash for a site, the public transparency anchor. */
export async function ledgerHead(siteId: string): Promise<{ seq: number; headHash: string | null }> {
  const rows = await sql`
    select seq, row_hash from consent_receipts where site_id = ${siteId} order by seq desc limit 1`;
  if (!rows[0]) return { seq: 0, headHash: null };
  return { seq: Number(rows[0].seq), headHash: toBuffer(rows[0].row_hash).toString("hex") };
}

function toBuffer(v: unknown): Buffer {
  if (Buffer.isBuffer(v)) return v;
  if (v instanceof Uint8Array) return Buffer.from(v);
  throw new Error("expected bytea buffer from DB");
}
