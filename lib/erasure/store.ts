import type postgres from "postgres";
import { sql } from "@/lib/db/client";
import { writeAudit } from "@/lib/audit/write";
import type { ErasureKind, ErasureStatus, ErasureRow } from "./types";

// Re-export so existing server-side importers keep `@/lib/erasure/store` working.
export type { ErasureKind, ErasureStatus, ErasureRow } from "./types";
export { ERASURE_KIND_LABELS, ERASURE_STATUS_LABELS } from "./types";

type DbExecutor = postgres.Sql | postgres.TransactionSql;

export interface OpenObligationInput {
  siteId: string;
  subjectId: string | null;
  requestId?: string | null;
  kind: ErasureKind;
  sourceAction?: string | null;
  basis?: string | null;
  dueAt: Date;
}

export interface OpenObligationResult {
  /** True when a new obligation row was created (vs. an existing one bumped). */
  created: boolean;
  id: string | null;
}

/**
 * Open an erasure obligation, idempotently. The partial unique indexes
 * (site,subject,kind) and (request_id) mean a repeated trigger, a second
 * withdrawal, a re-run sweep, updates the existing open row rather than
 * duplicating it. Returns whether a new row was created and its id.
 *
 * Pass `db` to enrol this in a surrounding transaction (e.g. the consent-write
 * txn, so the obligation commits atomically with the withdrawal receipt).
 */
export async function openObligation(input: OpenObligationInput, db: DbExecutor = sql): Promise<OpenObligationResult> {
  // Subject-scoped obligations dedupe on (site, subject, kind).
  if (input.subjectId) {
    const rows = await db`
      insert into erasure_obligations (site_id, subject_id, kind, source_action, basis, due_at)
      values (${input.siteId}, ${input.subjectId}, ${input.kind}, ${input.sourceAction ?? null},
              ${input.basis ?? null}, ${input.dueAt})
      on conflict (site_id, subject_id, kind) where subject_id is not null
      do update set updated_at = now()
      returning id, (xmax = 0) as inserted`;
    return { created: Boolean(rows[0]?.inserted), id: (rows[0]?.id as string) ?? null };
  }
  // Request-scoped obligations dedupe on request_id.
  if (input.requestId) {
    const rows = await db`
      insert into erasure_obligations (site_id, request_id, kind, source_action, basis, due_at)
      values (${input.siteId}, ${input.requestId}, ${input.kind}, ${input.sourceAction ?? null},
              ${input.basis ?? null}, ${input.dueAt})
      on conflict (request_id) where request_id is not null
      do update set updated_at = now()
      returning id, (xmax = 0) as inserted`;
    return { created: Boolean(rows[0]?.inserted), id: (rows[0]?.id as string) ?? null };
  }
  // No dedupe key, plain insert.
  const rows = await db`
    insert into erasure_obligations (site_id, kind, source_action, basis, due_at)
    values (${input.siteId}, ${input.kind}, ${input.sourceAction ?? null}, ${input.basis ?? null}, ${input.dueAt})
    returning id`;
  return { created: true, id: (rows[0]?.id as string) ?? null };
}

function mapRow(r: Record<string, unknown>): ErasureRow {
  return {
    id: r.id as string,
    siteId: r.site_id as string,
    domain: (r.domain as string | null) ?? "",
    subjectId: (r.subject_id as string | null) ?? null,
    requestId: (r.request_id as string | null) ?? null,
    kind: r.kind as ErasureKind,
    sourceAction: (r.source_action as string | null) ?? null,
    basis: (r.basis as string | null) ?? null,
    dueAt: r.due_at as string,
    status: r.status as ErasureStatus,
    resolvedAt: (r.resolved_at as string | null) ?? null,
    resolutionNote: (r.resolution_note as string | null) ?? null,
    createdAt: r.created_at as string,
  };
}

/** Obligations for an org. `openOnly` hides resolved ones (the working queue). */
export async function listObligations(orgId: string, openOnly = false): Promise<ErasureRow[]> {
  const statusFilter = openOnly ? sql`and e.status in ('open','in_progress')` : sql``;
  const rows = await sql`
    select e.id, e.site_id, e.subject_id, e.request_id, e.kind, e.source_action, e.basis,
           e.due_at, e.status, e.resolved_at, e.resolution_note, e.created_at, s.domain
    from erasure_obligations e join sites s on s.id = e.site_id
    where s.org_id = ${orgId} ${statusFilter}
    order by e.due_at asc`;
  return (rows as unknown as Record<string, unknown>[]).map(mapRow);
}

/** Resolve an obligation (org-scoped): mark erased or not-required, with a note. */
export async function resolveObligation(
  orgId: string,
  actorUserId: string,
  id: string,
  status: Extract<ErasureStatus, "in_progress" | "done" | "not_required">,
  note: string | null,
): Promise<boolean> {
  return sql.begin(async (tx) => {
    const closing = status === "done" || status === "not_required";
    const rows = await tx`
      update erasure_obligations e
         set status = ${status},
             resolution_note = ${note},
             resolved_by = ${closing ? actorUserId : null},
             resolved_at = ${closing ? new Date() : null},
             updated_at = now()
        from sites s
       where e.id = ${id} and s.id = e.site_id and s.org_id = ${orgId}
      returning e.id`;
    if (!rows[0]) return false;
    await writeAudit({ orgId, actorUserId, action: "erasure.resolve", target: id, diff: { status } }, tx);
    return true;
  });
}

export interface ObligationCounts {
  open: number;
  overdue: number;
}

export async function obligationCounts(orgId: string): Promise<ObligationCounts> {
  const rows = await sql`
    select
      count(*) filter (where e.status in ('open','in_progress')) as open,
      count(*) filter (where e.status in ('open','in_progress') and e.due_at < now()) as overdue
    from erasure_obligations e join sites s on s.id = e.site_id
    where s.org_id = ${orgId}`;
  return { open: Number(rows[0]?.open ?? 0), overdue: Number(rows[0]?.overdue ?? 0) };
}
