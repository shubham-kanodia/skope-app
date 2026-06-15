import { sql } from "@/lib/db/client";
import { writeAudit } from "@/lib/audit/write";
import type { BreachInput, BreachRow, BreachStatus, BreachNotification } from "./types";

function mapRow(r: Record<string, unknown>): BreachRow {
  return {
    id: r.id as string,
    siteId: (r.site_id as string | null) ?? null,
    domain: (r.domain as string | null) ?? null,
    detectedAt: r.detected_at as string,
    nature: r.nature as string,
    dataCategories: (r.data_categories as string[] | null) ?? [],
    estAffected: (r.est_affected as number | null) ?? null,
    remediation: (r.remediation as string | null) ?? "",
    status: r.status as BreachStatus,
    boardNotifiedAt: (r.board_notified_at as string | null) ?? null,
    principalsNotifiedAt: (r.principals_notified_at as string | null) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

/** Record a new breach incident. Returns the new id. */
export async function createIncident(
  orgId: string,
  actorUserId: string,
  siteId: string | null,
  input: BreachInput,
): Promise<string> {
  return sql.begin(async (tx) => {
    const rows = await tx`
      insert into breach_incidents
        (org_id, site_id, detected_at, nature, data_categories, est_affected, remediation, created_by)
      values
        (${orgId}, ${siteId}, ${input.detectedAt}, ${input.nature}, ${input.dataCategories},
         ${input.estAffected}, ${input.remediation}, ${actorUserId})
      returning id`;
    const id = rows[0].id as string;
    await writeAudit(
      {
        orgId,
        actorUserId,
        action: "breach.create",
        target: id,
        diff: { detectedAt: input.detectedAt, estAffected: input.estAffected, categories: input.dataCategories },
      },
      tx,
    );
    return id;
  });
}

/** List an org's incidents, newest first, with the site domain joined in. */
export async function listIncidents(orgId: string): Promise<BreachRow[]> {
  const rows = await sql`
    select b.id, b.site_id, b.detected_at, b.nature, b.data_categories, b.est_affected,
           b.remediation, b.status, b.board_notified_at, b.principals_notified_at,
           b.created_at, b.updated_at, s.domain
    from breach_incidents b left join sites s on s.id = b.site_id
    where b.org_id = ${orgId}
    order by b.detected_at desc`;
  return (rows as unknown as Record<string, unknown>[]).map(mapRow);
}

/** A single incident scoped to its org (authorization baked into the WHERE). */
export async function getIncident(orgId: string, id: string): Promise<BreachRow | null> {
  const rows = await sql`
    select b.id, b.site_id, b.detected_at, b.nature, b.data_categories, b.est_affected,
           b.remediation, b.status, b.board_notified_at, b.principals_notified_at,
           b.created_at, b.updated_at, s.domain
    from breach_incidents b left join sites s on s.id = b.site_id
    where b.org_id = ${orgId} and b.id = ${id}
    limit 1`;
  if (!rows[0]) return null;
  return mapRow(rows[0] as unknown as Record<string, unknown>);
}

/** Update an incident's status (org-scoped). */
export async function updateIncidentStatus(
  orgId: string,
  actorUserId: string,
  id: string,
  status: BreachStatus,
): Promise<boolean> {
  return sql.begin(async (tx) => {
    const rows = await tx`
      update breach_incidents set status = ${status}, updated_at = now()
      where org_id = ${orgId} and id = ${id}
      returning id`;
    if (!rows[0]) return false;
    await writeAudit({ orgId, actorUserId, action: "breach.status", target: id, diff: { status } }, tx);
    return true;
  });
}

/**
 * Record that a breach notification was sent to the Board or to affected
 * principals: stores a snapshot of the notice and stamps the matching timestamp
 * + advances the incident status. Org-scoped.
 */
export async function recordNotification(
  orgId: string,
  actorUserId: string,
  id: string,
  args: {
    audience: "board" | "principals";
    channel: string;
    recipientCount: number | null;
    subject: string;
    body: string;
  },
): Promise<boolean> {
  return sql.begin(async (tx) => {
    const incident = await tx`select id from breach_incidents where org_id = ${orgId} and id = ${id} limit 1`;
    if (!incident[0]) return false;

    await tx`
      insert into breach_notifications (incident_id, audience, channel, recipient_count, payload)
      values (${id}, ${args.audience}, ${args.channel}, ${args.recipientCount},
              ${tx.json({ subject: args.subject, body: args.body })})`;

    const stampColumn = args.audience === "board" ? "board_notified_at" : "principals_notified_at";
    const nextStatus: BreachStatus = args.audience === "board" ? "board_notified" : "principals_notified";
    await tx`
      update breach_incidents
        set ${tx(stampColumn)} = now(), status = ${nextStatus}, updated_at = now()
      where org_id = ${orgId} and id = ${id}`;

    await writeAudit(
      {
        orgId,
        actorUserId,
        action: "breach.notify",
        target: id,
        diff: { audience: args.audience, channel: args.channel, recipientCount: args.recipientCount },
      },
      tx,
    );
    return true;
  });
}

/** Notifications recorded against one incident, newest first. */
export async function listNotifications(orgId: string, incidentId: string): Promise<BreachNotification[]> {
  const rows = await sql`
    select n.id, n.audience, n.channel, n.recipient_count, n.payload, n.sent_at
    from breach_notifications n
    join breach_incidents b on b.id = n.incident_id
    where b.org_id = ${orgId} and n.incident_id = ${incidentId}
    order by n.sent_at desc`;
  return (rows as unknown as Record<string, unknown>[]).map((r) => {
    const payload = (r.payload ?? {}) as { subject?: string; body?: string };
    return {
      id: r.id as string,
      audience: r.audience as "board" | "principals",
      channel: r.channel as string,
      recipientCount: (r.recipient_count as number | null) ?? null,
      subject: payload.subject ?? "",
      body: payload.body ?? "",
      sentAt: r.sent_at as string,
    };
  });
}
