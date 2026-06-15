import { sql } from "@/lib/db/client";
import { writeAudit } from "@/lib/audit/write";
import type { CessationStatus, CessationTask } from "./types";

// Re-export so existing server-side importers keep `@/lib/cessation/store` working.
export type { CessationStatus, CessationTask } from "./types";
export { CESSATION_STATUS_LABELS } from "./types";

function mapRow(r: Record<string, unknown>): CessationTask {
  return {
    id: r.id as string,
    obligationId: r.obligation_id as string,
    recipientId: r.recipient_id as string,
    recipientName: (r.recipient_name as string | null) ?? "(removed recipient)",
    hasWebhook: Boolean(r.webhook_url),
    status: r.status as CessationStatus,
    signalledAt: (r.signalled_at as string | null) ?? null,
    ackAt: (r.ack_at as string | null) ?? null,
    note: (r.note as string | null) ?? null,
  };
}

/** Cessation tasks across an org, joined to the recipient. For the queue + bundle. */
export async function listCessationForOrg(orgId: string): Promise<CessationTask[]> {
  const rows = await sql`
    select c.id, c.obligation_id, c.recipient_id, c.status, c.signalled_at, c.ack_at, c.note,
           r.name as recipient_name, r.webhook_url
    from cessation_tasks c
    join erasure_obligations e on e.id = c.obligation_id
    join sites s on s.id = e.site_id
    left join recipients r on r.id = c.recipient_id
    where s.org_id = ${orgId}
    order by c.created_at asc`;
  return (rows as unknown as Record<string, unknown>[]).map(mapRow);
}

/** A single org-scoped task with its recipient webhook (for signalling). */
async function getTask(orgId: string, taskId: string): Promise<{ id: string; webhookUrl: string | null } | null> {
  const rows = await sql`
    select c.id, r.webhook_url
    from cessation_tasks c
    join erasure_obligations e on e.id = c.obligation_id
    join sites s on s.id = e.site_id
    left join recipients r on r.id = c.recipient_id
    where s.org_id = ${orgId} and c.id = ${taskId} limit 1`;
  if (!rows[0]) return null;
  return { id: rows[0].id as string, webhookUrl: (rows[0].webhook_url as string | null) ?? null };
}

/** Mark a task's status (org-scoped), stamping the matching timestamp. */
export async function setCessationStatus(
  orgId: string,
  actorUserId: string,
  taskId: string,
  status: CessationStatus,
  note: string | null,
): Promise<boolean> {
  const rows = await sql`
    update cessation_tasks c
       set status = ${status},
           note = ${note},
           signalled_at = case when ${status} = 'signalled' then now() else c.signalled_at end,
           ack_at = case when ${status} = 'acknowledged' then now() else c.ack_at end
      from erasure_obligations e, sites s
     where c.id = ${taskId} and e.id = c.obligation_id and s.id = e.site_id and s.org_id = ${orgId}
    returning c.id`;
  if (!rows[0]) return false;
  await writeAudit({ orgId, actorUserId, action: "cessation.status", target: taskId, diff: { status } });
  return true;
}

/**
 * Signal an integrated processor to cease, by POSTing a cease notice to its
 * configured webhook. Marks the task 'signalled' on success. Non-integrated
 * recipients (no webhook) are handled manually via setCessationStatus.
 */
export async function signalCessation(
  orgId: string,
  actorUserId: string,
  taskId: string,
): Promise<{ ok: boolean; error?: string }> {
  const task = await getTask(orgId, taskId);
  if (!task) return { ok: false, error: "Task not found." };
  if (!task.webhookUrl) return { ok: false, error: "This recipient has no cease webhook. Handle it manually." };

  try {
    const res = await fetch(task.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "skope.cease_processing", taskId, at: new Date().toISOString() }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ok: false, error: `Recipient responded ${res.status}.` };
  } catch {
    return { ok: false, error: "Couldn't reach the recipient's webhook." };
  }

  await setCessationStatus(orgId, actorUserId, taskId, "signalled", "Signalled via webhook.");
  return { ok: true };
}
