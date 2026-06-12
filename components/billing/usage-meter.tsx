import { isUnlimited } from "@/lib/plans";
import type { UsageSummary } from "@/lib/usage";

/** Monthly consent usage against the plan limit. Amber near the cap, over = bold. */
export function UsageMeter({ usage, compact = false }: { usage: UsageSummary; compact?: boolean }) {
  const { used, limit, percent, overLimit } = usage;
  const barColor = overLimit ? "bg-amber" : percent >= 80 ? "bg-amber" : "bg-primary";
  const fmt = (n: number) => n.toLocaleString("en-IN");

  return (
    <div className={compact ? "" : "rounded-2xl border border-hairline p-5"}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-ink">{compact ? "Consents this month" : "Monthly consents"}</span>
        <span className={overLimit ? "font-medium text-amber" : "text-muted"}>
          {fmt(used)} / {isUnlimited(limit) ? "∞" : fmt(limit)}
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-strong">
        <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${percent}%` }} />
      </div>
      {overLimit && !compact && (
        <p className="mt-2 text-sm text-amber">
          You&apos;re over this month&apos;s limit. Your banner stays live, upgrade to keep editing in the dashboard.
        </p>
      )}
    </div>
  );
}
