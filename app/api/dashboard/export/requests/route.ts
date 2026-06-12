import { sql } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { listRequestsForExport } from "@/lib/requests/store";
import { toCsvRow } from "@/lib/export/csv";

export const runtime = "nodejs";

/**
 * CSV download of an org's data-principal requests. Contains decrypted
 * requester contacts — the fiduciary needs them to evidence their handling —
 * so the download itself is audit-logged and documented as confidential.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Sign in to do this." }, { status: 401 });
  }
  const siteId = new URL(request.url).searchParams.get("site") ?? undefined;

  await sql`
    insert into audit_log (org_id, actor_user_id, action, target)
    values (${session.orgId}, ${session.userId}, 'export.requests', ${siteId ?? "all"})`;

  const rows = await listRequestsForExport(session.orgId, siteId);
  let csv = toCsvRow([
    "created_at",
    "domain",
    "type",
    "status",
    "contact_email",
    "detail",
    "due_at",
    "completed_at",
    "resolution_note",
  ]);
  for (const r of rows) {
    csv += toCsvRow([
      new Date(r.createdAt).toISOString(),
      r.domain,
      r.type,
      r.status,
      r.email ?? "",
      r.detail,
      r.dueAt ? new Date(r.dueAt).toISOString() : "",
      r.completedAt ? new Date(r.completedAt).toISOString() : "",
      r.resolutionNote ?? "",
    ]);
  }

  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="skope-requests-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
