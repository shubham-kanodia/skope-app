import { requireSession } from "@/lib/auth/guard";
import { getOrgGate } from "@/lib/billing/gate";
import { listReceiptsForOrg, countReceiptsForOrg, type ReceiptRow } from "@/lib/consent/list";
import { EmptyState } from "@/components/ui/empty-state";
import { ExportMenu } from "@/components/dashboard/export-menu";

const ACTION_LABEL: Record<string, string> = {
  grant: "Accepted all",
  deny: "Rejected non-essential",
  update: "Updated choices",
  withdraw: "Withdrew",
  withdraw_all: "Withdrew all",
};

const METHOD_LABEL: Record<string, string> = {
  banner: "Banner",
  preference_center: "Preference center",
  form: "Form",
  api: "API",
};

const when = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});

export default async function RecordsPage() {
  const session = await requireSession();
  const [receipts, total, gate] = await Promise.all([
    listReceiptsForOrg(session.orgId),
    countReceiptsForOrg(session.orgId),
    getOrgGate(session.orgId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[2rem] leading-tight">Consent records</h1>
        <p className="mt-1 text-body">
          Every consent, withdrawal, and request, timestamped and hash-chained, so the record can&apos;t be altered.
        </p>
      </div>

      {receipts.length === 0 ? (
        <EmptyState
          illustration={<ReceiptIcon />}
          title="No records yet."
          hint="Once your banner is live and a visitor makes a choice, each decision shows up here as a tamper-evident receipt."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {total.toLocaleString("en-IN")} receipt{total === 1 ? "" : "s"}
              {total > receipts.length ? ` · showing the latest ${receipts.length}` : ""}
            </p>
            <ExportMenu
              csvHref="/api/dashboard/export/receipts"
              csvLabel="Download CSV"
              bundle={{ allowed: gate?.limits.auditExport ?? false }}
            />
          </div>
          <div className="overflow-x-auto rounded-2xl border border-hairline-soft bg-canvas shadow-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline text-left text-xs text-muted">
                  <Th>When (IST)</Th>
                  <Th>Site</Th>
                  <Th>Decision</Th>
                  <Th>Purposes</Th>
                  <Th>Channel</Th>
                  <Th>Region</Th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((r, i) => (
                  <Row key={i} r={r} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function ReceiptIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--muted-soft)" strokeWidth="1.5" aria-hidden>
      <path d="M6 3h8l5 5v13l-2-1.2L15 21l-2-1.2L11 21l-2-1.2L7 21l-1-.6V3z" />
      <path d="M14 3v5h5" />
      <path d="M9 12h6M9 15.5h4" />
    </svg>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap px-4 py-2.5 font-medium">{children}</th>;
}

function Row({ r }: { r: ReceiptRow }) {
  const granted = r.purposes_granted ?? [];
  const denied = r.purposes_denied ?? [];
  return (
    <tr className="border-b border-hairline-soft last:border-0">
      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-body">{when.format(new Date(r.occurred_at))}</td>
      <td className="whitespace-nowrap px-4 py-3 text-ink">{r.domain}</td>
      <td className="whitespace-nowrap px-4 py-3 text-ink">{ACTION_LABEL[r.action] ?? r.action}</td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {granted.map((p) => (
            <span key={p} className="rounded-full bg-success/10 px-2 py-0.5 text-xs text-success">{p}</span>
          ))}
          {denied.map((p) => (
            <span key={p} className="rounded-full bg-surface-strong px-2 py-0.5 text-xs text-muted line-through">{p}</span>
          ))}
        </div>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-body">{METHOD_LABEL[r.method] ?? r.method}</td>
      <td className="whitespace-nowrap px-4 py-3 text-body">{r.region ?? "-"}</td>
    </tr>
  );
}
