import { requireSession } from "@/lib/auth/guard";
import { listRequestsForOrg, type RequestRow } from "@/lib/requests/store";
import { EmptyState } from "@/components/ui/empty-state";
import { ExportMenu } from "@/components/dashboard/export-menu";
import { RequestsList } from "./requests-list";

function InboxIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--muted-soft)" strokeWidth="1.5" aria-hidden>
      <path d="M4 13l2.5-8h11L20 13v6H4v-6z" />
      <path d="M4 13h5a3 3 0 0 0 6 0h5" />
    </svg>
  );
}

function countOverdue(open: RequestRow[]): number {
  const now = Date.now();
  return open.filter((r) => r.dueAt && new Date(r.dueAt).getTime() < now).length;
}

export default async function RequestsPage() {
  const session = await requireSession();
  const requests = await listRequestsForOrg(session.orgId);

  const open = requests.filter((r) => r.status === "new" || r.status === "in_progress");
  const overdue = countOverdue(open);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[2rem] leading-tight">Rights requests</h1>
        <p className="mt-1 text-body">
          Access, correction, erasure, nomination, and grievance requests from your visitors. Each
          has a due-date clock based on the response window you set per site.
        </p>
      </div>

      {requests.length === 0 ? (
        <EmptyState
          illustration={<InboxIcon />}
          title="No requests yet."
          hint="When a visitor submits a request from their privacy preferences page and confirms it by email, it shows up here with a due date."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {open.length} open
              {overdue > 0 ? ` · ${overdue} overdue` : ""} · {requests.length} total
            </p>
            <ExportMenu csvHref="/api/dashboard/export/requests" csvLabel="Download CSV" />
          </div>
          <RequestsList initial={requests} />
        </>
      )}
    </div>
  );
}
