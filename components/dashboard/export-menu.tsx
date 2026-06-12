import Link from "next/link";

/**
 * Download buttons for the records/requests pages. Plain anchors — the routes
 * stream attachments, no client state needed. The audit bundle is plan-gated
 * (growth+); below that it renders disabled with an upgrade hint.
 */
export function ExportMenu({
  csvHref,
  csvLabel,
  bundle,
}: {
  csvHref: string;
  csvLabel: string;
  /** Omit to hide the bundle button (e.g. on the requests page). */
  bundle?: { allowed: boolean };
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={csvHref}
        download
        className="rounded-full border border-hairline px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-strong"
      >
        {csvLabel}
      </a>
      {bundle &&
        (bundle.allowed ? (
          <a
            href="/api/dashboard/export/bundle"
            download
            className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-active"
          >
            Download audit bundle
          </a>
        ) : (
          <span className="group relative">
            <span className="cursor-not-allowed rounded-full border border-hairline px-4 py-2 text-sm font-medium text-muted">
              Download audit bundle
            </span>
            <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 hidden w-60 -translate-x-1/2 rounded-xl border border-hairline bg-canvas p-3 text-xs text-body shadow-lg group-hover:block">
              Audit bundles — receipts, notice versions, and a chain-verification report in one ZIP —
              are on the Growth plan.{" "}
              <Link href="/dashboard/billing" className="font-medium text-primary">
                See plans
              </Link>
            </span>
          </span>
        ))}
    </div>
  );
}
