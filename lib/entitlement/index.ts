/**
 * Entitlement, the single source of truth for "what is this org allowed to do".
 *
 * Commercial rules, encoded once here and read everywhere (banner, feature
 * gates, checkout):
 *   1. There is no free plan and no trial: a new org is read-only until it
 *      subscribes (its public banner keeps serving the whole time).
 *   2. A paid subscription unlocks its tier while plan_active_until is null
 *      (manual grant) or in the future.
 *   3. Legacy: early orgs created under the old "first 50 founding members"
 *      program keep their 2-year comp (read path only; no new ones).
 */

export type OrgPlan = "starter" | "growth" | "scale";

/** The columns getEntitlement needs, a subset of the orgs row. */
export interface OrgEntitlementInput {
  plan: OrgPlan;
  is_founding_member: boolean;
  founding_number: number | null;
  comp_until: Date | string | null;
  /** When a paid subscription lapses; null = active (manual/comp grant). */
  plan_active_until?: Date | string | null;
}

export type EntitlementStatus = "founding" | "paid" | "inactive";

export interface Entitlement {
  status: EntitlementStatus;
  /** Tier used for plan-limit lookups. Founding unlocks Growth-equivalent limits. */
  tier: OrgPlan;
  /** Whether paid-tier features are unlocked right now. */
  unlocked: boolean;
  /** When the current founding/paid window ends (null for open-ended grants). */
  activeUntil: Date | null;
  /** Whole days remaining in the founding/paid window (null otherwise). */
  daysLeft: number | null;
  /** One brand-voiced line for the dashboard banner. */
  banner: string;
}

function toDate(v: Date | string | null): Date | null {
  if (v == null) return null;
  return v instanceof Date ? v : new Date(v);
}

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.ceil((to.getTime() - from.getTime()) / 86_400_000));
}

/**
 * A brand-new org gets no free plan, no trial, and no comp: it is read-only
 * (status "inactive") until it subscribes. We record this by setting
 * plan_active_until in the past, so getEntitlement's paid branch fails and it
 * falls through to "inactive". `foundingNumber` (from nextval) is accepted for
 * call-site compatibility but no longer grants anything.
 */
export function newOrgEntitlement(_foundingNumber: number) {
  return {
    plan_active_until: new Date(0),
    is_founding_member: false,
    founding_number: null as number | null,
    comp_until: null as Date | null,
  };
}

const YEAR_FMT = new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" });

export function getEntitlement(org: OrgEntitlementInput, now = new Date()): Entitlement {
  const comp = toDate(org.comp_until);

  // 1. Legacy founding member with a live comp window (closed program; read path).
  if (org.is_founding_member && comp && comp > now) {
    const badge = org.founding_number ? `Founding member #${org.founding_number}` : "Founding member";
    return {
      status: "founding",
      tier: "growth",
      unlocked: true,
      activeUntil: comp,
      daysLeft: daysBetween(now, comp),
      banner: `${badge}, compliance is free until ${YEAR_FMT.format(comp)}.`,
    };
  }

  // 2. Paying customer, while the subscription is active (null = manual/comp grant).
  const activeUntil = toDate(org.plan_active_until ?? null);
  if (activeUntil == null || activeUntil > now) {
    return {
      status: "paid",
      tier: org.plan,
      unlocked: true,
      activeUntil,
      daysLeft: activeUntil ? daysBetween(now, activeUntil) : null,
      banner: "",
    };
  }

  // 3. Inactive: no live subscription. Read-only, but the public banner still
  // serves. Limits are shown for the org's plan tier.
  return {
    status: "inactive",
    tier: org.plan,
    unlocked: false,
    activeUntil: null,
    daysLeft: null,
    banner: "Subscribe to keep editing. Your banner stays live.",
  };
}
