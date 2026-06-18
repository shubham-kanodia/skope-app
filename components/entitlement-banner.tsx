import type { Entitlement } from "@/lib/entitlement";
import { ApertureMark } from "@/components/aperture/aperture";

/**
 * The status strip atop the dashboard content. Primary for the founding badge,
 * neutral for an inactive (read-only) org that needs to subscribe.
 */
export function EntitlementBanner({ entitlement }: { entitlement: Entitlement }) {
  if (!entitlement.banner) return null;

  const celebratory = entitlement.status === "founding";
  const tone = celebratory
    ? "border-primary/15 bg-primary/[0.04] text-ink"
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
          Subscribe →
        </a>
      )}
    </div>
  );
}

function Icon({ status }: { status: Entitlement["status"] }) {
  if (status === "founding") {
    return <ApertureMark tone="light" size={16} open={0.55} />;
  }
  return null;
}
