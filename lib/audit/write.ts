import type postgres from "postgres";
import { sql } from "@/lib/db/client";

/**
 * Append a row to `audit_log`.
 *
 * Centralises what used to be inline `insert into audit_log …` statements so
 * every compliance feature (breach, erasure, cessation, recipients, SDF, …)
 * writes the same shape and an action namespace stays consistent.
 *
 * Pass `db` (a transaction handle from `sql.begin`) when the audit row must
 * commit atomically with the change it records, e.g. a breach status change
 * or an erasure obligation opened alongside a consent receipt.
 *
 * Action namespace convention: `<domain>.<verb>`, e.g. `breach.create`,
 * `breach.notify`, `erasure.open`, `erasure.resolve`, `cessation.signal`,
 * `recipient.create`, `access.respond`, `sdf.dpia`, `retro.send`,
 * `nomination.activate`, `grievance.frivolous`.
 */
export interface AuditEntry {
  orgId: string | null;
  actorUserId?: string | null;
  action: string;
  target?: string | null;
  diff?: unknown;
}

type DbExecutor = postgres.Sql | postgres.TransactionSql;

export async function writeAudit(entry: AuditEntry, db: DbExecutor = sql): Promise<void> {
  const { orgId, actorUserId = null, action, target = null, diff } = entry;
  await db`
    insert into audit_log (org_id, actor_user_id, action, target, diff)
    values (${orgId}, ${actorUserId}, ${action}, ${target},
            ${diff === undefined || diff === null ? null : db.json(diff as never)})`;
}
