import { sql } from "@/lib/db/client";
import { encryptField, decryptField } from "@/lib/encryption";
import { writeAudit } from "@/lib/audit/write";
import { sendEmail } from "@/lib/email/send";
import { getPublishedNoticeVersion } from "@/lib/notices/store";

export { parseEmailList } from "./parse";

/** Create a retrospective-notice batch and queue one row per recipient (encrypted). */
export async function createBatch(
  orgId: string,
  actorUserId: string,
  siteId: string,
  emails: string[],
): Promise<{ batchId: string; queued: number }> {
  const noticeVersion = await getPublishedNoticeVersion(siteId);
  const batchRows = await sql`
    insert into retro_notice_batches (site_id, notice_version, created_by)
    values (${siteId}, ${noticeVersion}, ${actorUserId}) returning id`;
  const batchId = batchRows[0].id as string;

  for (const email of emails) {
    const enc = await encryptField(orgId, email);
    await sql`insert into retro_notice_recipients (batch_id, email_enc) values (${batchId}, ${enc})`;
  }
  await writeAudit({ orgId, actorUserId, action: "retro.send", target: batchId, diff: { queued: emails.length } });
  return { batchId, queued: emails.length };
}

export interface BatchSummary {
  id: string;
  siteId: string;
  domain: string;
  noticeVersion: number | null;
  createdAt: string;
  total: number;
  sent: number;
  failed: number;
  queued: number;
}

export async function listBatches(orgId: string): Promise<BatchSummary[]> {
  const rows = await sql`
    select b.id, b.site_id, b.notice_version, b.created_at, s.domain,
           count(r.*) as total,
           count(r.*) filter (where r.status = 'sent') as sent,
           count(r.*) filter (where r.status in ('failed','bounced')) as failed,
           count(r.*) filter (where r.status = 'queued') as queued
    from retro_notice_batches b
    join sites s on s.id = b.site_id
    left join retro_notice_recipients r on r.batch_id = b.id
    where s.org_id = ${orgId}
    group by b.id, b.site_id, b.notice_version, b.created_at, s.domain
    order by b.created_at desc`;
  return (rows as unknown as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    siteId: r.site_id as string,
    domain: r.domain as string,
    noticeVersion: (r.notice_version as number | null) ?? null,
    createdAt: r.created_at as string,
    total: Number(r.total),
    sent: Number(r.sent),
    failed: Number(r.failed),
    queued: Number(r.queued),
  }));
}

/**
 * Drain queued retrospective-notice recipients: send the §5(2) notice and log
 * per-recipient delivery. Called from the cron. Bounded per run so a huge list
 * spreads across runs rather than timing out.
 */
export async function runRetroSweep(limit = 500): Promise<{ sent: number; failed: number }> {
  const rows = await sql`
    select r.id, r.email_enc, r.batch_id, b.site_id, s.org_id, s.site_key, s.domain
    from retro_notice_recipients r
    join retro_notice_batches b on b.id = r.batch_id
    join sites s on s.id = b.site_id
    where r.status = 'queued'
    order by r.created_at asc
    limit ${limit}`;

  let sent = 0;
  let failed = 0;
  const appBase = process.env.NEXT_PUBLIC_APP_URL ?? "";

  for (const r of rows as unknown as Record<string, unknown>[]) {
    const id = r.id as string;
    const orgId = r.org_id as string;
    const domain = r.domain as string;
    const link = `${appBase}/p/${r.site_key as string}/privacy`;
    let email: string;
    try {
      email = await decryptField(orgId, toBuffer(r.email_enc));
    } catch {
      await sql`update retro_notice_recipients set status = 'failed', error = 'decrypt failed' where id = ${id}`;
      failed += 1;
      continue;
    }

    try {
      await sendEmail({
        to: email,
        subject: `How ${domain} handles your personal data`,
        text: `Under India's Digital Personal Data Protection Act, we're sharing our privacy notice, which explains what personal data ${domain} holds, why, how to exercise your rights, and how to complain. Read it here: ${link}`,
        html: `<p>Under India's Digital Personal Data Protection Act, we're sharing our privacy notice, which explains what personal data <strong>${domain}</strong> holds, why, how to exercise your rights, and how to complain.</p><p><a href="${link}">Read our privacy notice</a></p>`,
      });
      await sql`update retro_notice_recipients set status = 'sent', sent_at = now() where id = ${id}`;
      sent += 1;
    } catch (err) {
      await sql`update retro_notice_recipients set status = 'failed', error = ${String(err).slice(0, 200)} where id = ${id}`;
      failed += 1;
    }
  }
  return { sent, failed };
}

export async function siteExists(orgId: string, siteId: string): Promise<boolean> {
  const rows = await sql`select 1 from sites where id = ${siteId} and org_id = ${orgId} limit 1`;
  return Boolean(rows[0]);
}

/** Per-recipient delivery rows for the audit bundle (no raw emails). */
export async function listDeliveryForOrg(
  orgId: string,
): Promise<{ domain: string; batchId: string; status: string; sentAt: string | null; error: string | null }[]> {
  const rows = await sql`
    select s.domain, r.batch_id, r.status, r.sent_at, r.error
    from retro_notice_recipients r
    join retro_notice_batches b on b.id = r.batch_id
    join sites s on s.id = b.site_id
    where s.org_id = ${orgId}
    order by r.created_at asc`;
  return (rows as unknown as Record<string, unknown>[]).map((r) => ({
    domain: r.domain as string,
    batchId: r.batch_id as string,
    status: r.status as string,
    sentAt: (r.sent_at as string | null) ?? null,
    error: (r.error as string | null) ?? null,
  }));
}

function toBuffer(v: unknown): Buffer {
  if (Buffer.isBuffer(v)) return v;
  if (v instanceof Uint8Array) return Buffer.from(v);
  throw new Error("expected bytea buffer from DB");
}
