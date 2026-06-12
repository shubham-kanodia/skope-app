import type { Entitlement } from "@/lib/entitlement";
import { ApertureMark } from "@/components/aperture/aperture";

/**
 * The trial / founding-member status strip atop the dashboard content.
 * Amber for trial urgency, primary for the founding badge, neutral for free.
 */
export function EntitlementBanner({ entitlement }: { entitlement: Entitlement }) {
  if (!entitlement.banner) return null;

  const celebratory = entitlement.status === "founding" || entitlement.status === "launch";
  const tone = celebratory
    ? "border-primary/15 bg-primary/[0.04] text-ink"
    : entitlement.status === "trial"
      ? "border-amber/30 bg-amber/[0.07] text-ink"
      : "border-hairline bg-surface-soft text-ink";

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 border-b px-6 py-2.5 text-sm sm:px-8 ${tone}`}
    >
      <span className="flex items-center gap-2">
        <Icon status={entitlement.status} />
        {entitlement.banner}
      </span>
      {!celebratory && (
        <a href="/dashboard/billing" className="font-medium text-primary hover:text-primary-active">
          {entitlement.status === "free" ? "Upgrade" : "Add a plan"} →
        </a>
      )}
    </div>
  );
}

function Icon({ status }: { status: Entitlement["status"] }) {
  if (status === "founding" || status === "launch") {
    return <ApertureMark tone="light" size={16} open={0.55} />;
  }
  if (status === "trial") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="2" aria-hidden>
        <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
      </svg>
    );
  }
  return null;
}
