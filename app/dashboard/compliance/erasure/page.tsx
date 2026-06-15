import Link from "next/link";
import { requireSession } from "@/lib/auth/guard";
import { listObligations } from "@/lib/erasure/store";
import { listCessationForOrg, type CessationTask } from "@/lib/cessation/store";
import { EmptyState } from "@/components/ui/empty-state";
import { Callout } from "@/components/ui/callout";
import { ErasureList } from "./erasure-list";

function countOverdue(rows: { dueAt: string; status: string }[]): number {
  const now = Date.now();
  return rows.filter(
    (r) => (r.status === "open" || r.status === "in_progress") && new Date(r.dueAt).getTime() < now,
  ).length;
}

export default async function ErasurePage() {
  const session = await requireSession();
  const obligations = await listObligations(session.orgId);
  const cessation = await listCessationForOrg(session.orgId);
  const open = obligations.filter((r) => r.status === "open" || r.status === "in_progress");
  const overdue = countOverdue(obligations);

  // Group cessation tasks by their obligation for display under each row.
  const cessationByObligation: Record<string, CessationTask[]> = {};
  for (const t of cessation) {
    (cessationByObligation[t.obligationId] ??= []).push(t);
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/compliance" className="text-sm text-muted hover:text-ink">
          ← Compliance
        </Link>
        <h1 className="mt-1 text-[2rem] leading-tight">Data to delete</h1>
        <p className="mt-1 max-w-2xl text-body">
          When someone withdraws, or you no longer need their data, you should delete it. Skope lists
          each one here. You delete the data in your own systems and tick it off, or note why you have
          to keep it (for example, a legal hold).
        </p>
      </div>

      <Callout tone="info" title="Skope reminds, you erase">
        Your data lives in your systems, not Skope&apos;s, so Skope can&apos;t delete it for you. It
        opens the obligation, sets a due date, and keeps the record for your audit bundle.
      </Callout>

      {obligations.length === 0 ? (
        <EmptyState
          title="Nothing due for erasure."
          hint="Withdrawals open an obligation here automatically, and the retention sweep adds principals who've been inactive past your retention window."
        />
      ) : (
        <>
          <p className="text-sm text-muted">
            {open.length} open{overdue > 0 ? ` · ${overdue} overdue` : ""} · {obligations.length} total
          </p>
          <ErasureList initial={obligations} cessation={cessationByObligation} />
        </>
      )}
    </div>
  );
}
