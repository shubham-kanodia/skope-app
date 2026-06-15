import Link from "next/link";
import { requireSession } from "@/lib/auth/guard";
import { listIncidents } from "@/lib/breach/store";
import { BREACH_STATUS_LABELS } from "@/lib/breach/types";
import { EmptyState } from "@/components/ui/empty-state";
import { Callout } from "@/components/ui/callout";

const when = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });

export default async function BreachListPage() {
  const session = await requireSession();
  const incidents = await listIncidents(session.orgId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/dashboard/compliance" className="text-sm text-muted hover:text-ink">
            ← Compliance
          </Link>
          <h1 className="mt-1 text-[2rem] leading-tight">Report a breach</h1>
          <p className="mt-1 max-w-2xl text-body">
            If personal data is exposed, lost, or seen by the wrong people, you have to tell the
            regulator and the people affected. Record what happened here, Skope writes the notices for
            you, and you mark when each one was sent.
          </p>
        </div>
        <Link
          href="/dashboard/compliance/breach/new"
          className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-active"
        >
          Record a breach
        </Link>
      </div>

      {incidents.length === 0 ? (
        <EmptyState
          title="No incidents recorded."
          hint="Hopefully it stays that way. If a breach happens, record it here as soon as you know, the clock for notifying the Board starts at detection."
        />
      ) : (
        <div className="space-y-3">
          {incidents.map((b) => (
            <Link
              key={b.id}
              href={`/dashboard/compliance/breach/${b.id}`}
              className="block rounded-2xl border border-hairline p-5 transition-colors hover:border-primary/40 hover:bg-surface-soft"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-surface-strong px-2.5 py-0.5 text-xs font-medium text-ink">
                      {BREACH_STATUS_LABELS[b.status]}
                    </span>
                    {b.domain && <span className="text-xs text-muted">{b.domain}</span>}
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-ink">{b.nature}</p>
                  <p className="mt-1 text-xs text-muted">
                    Detected {when.format(new Date(b.detectedAt))}
                    {b.estAffected != null ? ` · ~${b.estAffected} affected` : ""}
                  </p>
                </div>
                <div className="text-right text-xs text-muted">
                  <p>{b.boardNotifiedAt ? "Board notified" : "Board not notified"}</p>
                  <p>{b.principalsNotifiedAt ? "People notified" : "People not notified"}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Callout tone="warn" title="Have counsel review before you send">
        The breach-notice format and the Board&apos;s channel are set by the DPDP Rules. The drafts
        Skope generates are a starting point with flagged gaps, confirm them with your lawyer.
      </Callout>
    </div>
  );
}
