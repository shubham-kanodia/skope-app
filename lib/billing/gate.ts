import { getOrgWithEntitlement, type Org } from "@/lib/orgs/queries";
import { getLimits, type PlanLimits } from "@/lib/plans";
import { getUsage, type UsageSummary } from "@/lib/usage";
import type { Entitlement } from "@/lib/entitlement";

/**
 * The single commercial gate the dashboard consults. Read-only kicks in when the
 * org is not unlocked (trial ended / subscription lapsed and on free) OR it has
 * blown past its monthly consent limit. The public banner/consent APIs are never
 * gated, only the dashboard's write surfaces are.
 */
export interface OrgGate {
  org: Org;
  entitlement: Entitlement;
  limits: PlanLimits;
  usage: UsageSummary;
  readOnly: boolean;
}

export async function getOrgGate(orgId: string): Promise<OrgGate | null> {
  const data = await getOrgWithEntitlement(orgId);
  if (!data) return null;
  const { org, entitlement } = data;
  const limits = getLimits(entitlement.tier);
  const usage = await getUsage(orgId, entitlement.tier);
  const readOnly = !entitlement.unlocked || usage.overLimit;
  return { org, entitlement, limits, usage, readOnly };
}

/** Reason string for a blocked write action, or null when writes are allowed. */
export function blockedReason(gate: OrgGate): string | null {
  if (!gate.readOnly) return null;
  if (gate.usage.overLimit) {
    return "You've hit this month's consent limit. Upgrade your plan to keep editing, your banner stays live.";
  }
  return "Your trial has ended. Upgrade to keep editing, your banner stays live.";
}

/**
 * Guard for write server actions: returns an upgrade-prompt error string when
 * the org is read-only, or null when the write may proceed. Convenience over
 * getOrgGate + blockedReason.
 */
export async function checkWritable(orgId: string): Promise<string | null> {
  const gate = await getOrgGate(orgId);
  if (!gate) return "Organisation not found.";
  return blockedReason(gate);
}

/**
 * Full write guard for server actions: blocks view-only members first, then the
 * billing read-only state. Returns an error string or null to proceed.
 */
export async function guardWrite(session: { orgId: string; role?: string | null }): Promise<string | null> {
  if (session.role === "viewer") {
    return "You have view-only access. Ask an owner or admin to make changes.";
  }
  return checkWritable(session.orgId);
}
