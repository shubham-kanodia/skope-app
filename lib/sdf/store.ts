import { sql } from "@/lib/db/client";
import { encryptField, decryptField } from "@/lib/encryption";
import { writeAudit } from "@/lib/audit/write";
import { sendEmail } from "@/lib/email/send";

/**
 * Significant Data Fiduciary toolkit (DPDP §10): designation + India-based DPO
 * attestation, DPIAs, the independent auditor record, and the audit cadence.
 */
export interface SdfSettings {
  isSdf: boolean;
  dpoIndiaBased: boolean;
  dpoName: string;
  dpoEmail: string;
}

export const DEFAULT_SDF_SETTINGS: SdfSettings = {
  isSdf: false,
  dpoIndiaBased: false,
  dpoName: "",
  dpoEmail: "",
};

export async function getSdfSettings(orgId: string): Promise<SdfSettings> {
  const rows = await sql`select is_sdf, dpo_india_based, dpo_name, dpo_email from sdf_settings where org_id = ${orgId}`;
  if (!rows[0]) return { ...DEFAULT_SDF_SETTINGS };
  return {
    isSdf: rows[0].is_sdf as boolean,
    dpoIndiaBased: rows[0].dpo_india_based as boolean,
    dpoName: (rows[0].dpo_name as string | null) ?? "",
    dpoEmail: (rows[0].dpo_email as string | null) ?? "",
  };
}

export async function saveSdfSettings(orgId: string, actorUserId: string, s: SdfSettings): Promise<void> {
  await sql`
    insert into sdf_settings (org_id, is_sdf, dpo_india_based, dpo_name, dpo_email, updated_at)
    values (${orgId}, ${s.isSdf}, ${s.dpoIndiaBased}, ${s.dpoName.slice(0, 160)}, ${s.dpoEmail.slice(0, 160)}, now())
    on conflict (org_id) do update set
      is_sdf = excluded.is_sdf, dpo_india_based = excluded.dpo_india_based,
      dpo_name = excluded.dpo_name, dpo_email = excluded.dpo_email, updated_at = now()`;
  await writeAudit({ orgId, actorUserId, action: "sdf.settings", target: orgId, diff: { isSdf: s.isSdf } });
}

// ---------- DPIA ----------

export interface DpiaRow {
  id: string;
  title: string;
  content: Record<string, unknown>;
  status: string;
  createdAt: string;
}

export async function listDpia(orgId: string): Promise<DpiaRow[]> {
  const rows = await sql`
    select id, title, content, status, created_at from dpia_assessments
    where org_id = ${orgId} order by created_at desc`;
  return (rows as unknown as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    title: r.title as string,
    content: (r.content ?? {}) as Record<string, unknown>,
    status: r.status as string,
    createdAt: r.created_at as string,
  }));
}

export async function createDpia(
  orgId: string,
  actorUserId: string,
  input: { title: string; content: Record<string, unknown>; status: string },
): Promise<string> {
  const rows = await sql`
    insert into dpia_assessments (org_id, title, content, status, created_by)
    values (${orgId}, ${input.title.slice(0, 200)}, ${sql.json(input.content as never)}, ${input.status}, ${actorUserId})
    returning id`;
  const id = rows[0].id as string;
  await writeAudit({ orgId, actorUserId, action: "sdf.dpia", target: id });
  return id;
}

// ---------- auditor ----------

export interface AuditorRow {
  id: string;
  name: string;
  firm: string | null;
  contactEmail: string | null;
  engagedAt: string | null;
}

export async function listAuditors(orgId: string): Promise<AuditorRow[]> {
  const rows = await sql`select id, name, firm, contact_enc, engaged_at from auditors where org_id = ${orgId} order by created_at desc`;
  const out: AuditorRow[] = [];
  for (const r of rows as unknown as Record<string, unknown>[]) {
    let contactEmail: string | null = null;
    if (r.contact_enc) {
      try {
        contactEmail = await decryptField(orgId, toBuffer(r.contact_enc));
      } catch {
        contactEmail = null;
      }
    }
    out.push({
      id: r.id as string,
      name: r.name as string,
      firm: (r.firm as string | null) ?? null,
      contactEmail,
      engagedAt: (r.engaged_at as string | null) ?? null,
    });
  }
  return out;
}

export async function addAuditor(
  orgId: string,
  actorUserId: string,
  input: { name: string; firm: string | null; contactEmail: string | null },
): Promise<void> {
  const enc = input.contactEmail ? await encryptField(orgId, input.contactEmail) : null;
  await sql`
    insert into auditors (org_id, name, firm, contact_enc, engaged_at)
    values (${orgId}, ${input.name.slice(0, 160)}, ${input.firm?.slice(0, 160) ?? null}, ${enc}, now())`;
  await writeAudit({ orgId, actorUserId, action: "sdf.auditor", target: orgId });
}

// ---------- audit cadence ----------

export interface AuditScheduleRow {
  cadenceDays: number;
  nextDueAt: string | null;
  lastCompletedAt: string | null;
}

export async function getAuditSchedule(orgId: string): Promise<AuditScheduleRow | null> {
  const rows = await sql`select cadence_days, next_due_at, last_completed_at from audit_schedules where org_id = ${orgId}`;
  if (!rows[0]) return null;
  return {
    cadenceDays: rows[0].cadence_days as number,
    nextDueAt: (rows[0].next_due_at as string | null) ?? null,
    lastCompletedAt: (rows[0].last_completed_at as string | null) ?? null,
  };
}

export async function saveAuditSchedule(orgId: string, actorUserId: string, cadenceDays: number): Promise<void> {
  const days = Math.min(3650, Math.max(30, Math.round(cadenceDays)));
  const nextDue = new Date(Date.now() + days * 86_400_000);
  await sql`
    insert into audit_schedules (org_id, cadence_days, next_due_at, updated_at)
    values (${orgId}, ${days}, ${nextDue}, now())
    on conflict (org_id) do update set cadence_days = ${days}, next_due_at = ${nextDue}, updated_at = now()`;
  await writeAudit({ orgId, actorUserId, action: "sdf.schedule", target: orgId, diff: { cadenceDays: days } });
}

/** Mark the periodic audit complete: stamp completion and roll the next due date. */
export async function completeAudit(orgId: string, actorUserId: string): Promise<void> {
  await sql`
    update audit_schedules
       set last_completed_at = now(),
           next_due_at = now() + (cadence_days || ' days')::interval,
           last_reminded_at = null,
           updated_at = now()
     where org_id = ${orgId}`;
  await writeAudit({ orgId, actorUserId, action: "sdf.audit_done", target: orgId });
}

/**
 * Remind SDF orgs whose periodic audit (DPDP §10(2)) is due. Emails the billing
 * contact at most once a week per org. Called from the retention-sweep cron.
 */
export async function runAuditReminders(): Promise<{ reminded: number }> {
  const rows = await sql`
    select a.org_id, a.next_due_at, o.billing_email, o.name
    from audit_schedules a join orgs o on o.id = a.org_id
    join sdf_settings sf on sf.org_id = a.org_id and sf.is_sdf = true
    where a.next_due_at is not null and a.next_due_at < now()
      and (a.last_reminded_at is null or a.last_reminded_at < now() - interval '7 days')`;
  let reminded = 0;
  for (const r of rows as unknown as Record<string, unknown>[]) {
    const orgId = r.org_id as string;
    const email = r.billing_email as string | null;
    if (email) {
      try {
        await sendEmail({
          to: email,
          subject: "Your DPDP periodic audit is due",
          text: `As a Significant Data Fiduciary, your periodic data audit (DPDP §10) is now due. Schedule it with your independent auditor and mark it complete in Skope under Compliance → Significant Data Fiduciary.`,
          html: `<p>As a Significant Data Fiduciary, your periodic data audit (DPDP §10) is now due.</p><p>Schedule it with your independent auditor and mark it complete in Skope under <strong>Compliance → Significant Data Fiduciary</strong>.</p>`,
        });
      } catch (err) {
        console.error("[sdf] reminder email failed", err);
      }
    }
    await sql`update audit_schedules set last_reminded_at = now() where org_id = ${orgId}`;
    await writeAudit({ orgId, action: "sdf.audit_due", target: orgId });
    reminded += 1;
  }
  return { reminded };
}

function toBuffer(v: unknown): Buffer {
  if (Buffer.isBuffer(v)) return v;
  if (v instanceof Uint8Array) return Buffer.from(v);
  throw new Error("expected bytea buffer from DB");
}
