import { getSession } from "@/lib/auth/session";
import { listReceiptsForExport, type ExportCursor } from "@/lib/consent/list";
import { toCsvRow } from "@/lib/export/csv";
import { writeAudit } from "@/lib/audit/write";

export const runtime = "nodejs";

const HEADER = [
  "occurred_at",
  "domain",
  "seq",
  "action",
  "method",
  "purposes_granted",
  "purposes_denied",
  "notice_version",
  "notice_checksum",
  "language",
  "region",
  "row_hash",
];

/**
 * CSV download of an org's consent receipts (optionally one site via ?site=).
 * Streams keyset-paginated batches so memory stays bounded at any ledger size.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Sign in to do this." }, { status: 401 });
  }
  const orgId = session.orgId;
  const siteId = new URL(request.url).searchParams.get("site") ?? undefined;

  await writeAudit({ orgId, actorUserId: session.userId, action: "export.receipts", target: siteId ?? "all" });

  const encoder = new TextEncoder();
  let cursor: ExportCursor | null = null;
  let sentHeader = false;

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (!sentHeader) {
        controller.enqueue(encoder.encode(toCsvRow(HEADER)));
        sentHeader = true;
      }
      const rows = await listReceiptsForExport(orgId, { siteId, after: cursor });
      if (rows.length === 0) {
        controller.close();
        return;
      }
      let chunk = "";
      for (const r of rows) {
        chunk += toCsvRow([
          new Date(r.occurred_at).toISOString(),
          r.domain,
          r.seq,
          r.action,
          r.method,
          (r.purposes_granted ?? []).join(" "),
          (r.purposes_denied ?? []).join(" "),
          r.notice_version ?? "",
          r.notice_checksum ?? "",
          r.language_shown ?? "",
          r.region ?? "",
          r.row_hash_hex,
        ]);
      }
      controller.enqueue(encoder.encode(chunk));
      const last = rows[rows.length - 1];
      cursor = { occurredAt: last.occurred_at, id: last.id };
    },
  });

  const date = new Date().toISOString().slice(0, 10);
  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="skope-receipts-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
