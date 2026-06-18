import type { OrgPlan } from "@/lib/entitlement";

/**
 * The single place plan tiers are defined. Pricing is consent-based: each tier
 * sets a monthly consent-event limit plus feature caps. Read everywhere via
 * getLimits(tier); getEntitlement() decides the effective tier (founding/trial
 * unlock "growth").
 *
 * [HUMAN-confirm] prices (INR/month) and limits before launch.
 */
export interface PlanLimits {
  label: string;
  priceInr: number;
  consentsPerMonth: number;
  /** Max sites; Number.POSITIVE_INFINITY = unlimited. */
  maxSites: number;
  /**
   * All tiers include every supported language. Regional-language notices may be
   * a legal requirement under DPDP, so we never gate languages by plan. Kept as a
   * field for clarity (always true).
   */
  allLanguages: boolean;
  /** Max total users in the org (owner + teammates). >1 means team invites. */
  teamSeats: number;
  /** Hide the "Secured by Skope" banner footer brand. */
  whiteLabel: boolean;
  /** Download the regulator-ready audit bundle (CSV exports are never gated). */
  auditExport: boolean;
}

export const PLAN_LIMITS: Record<OrgPlan, PlanLimits> = {
  starter: { label: "Starter", priceInr: 999, consentsPerMonth: 25_000, maxSites: 3, allLanguages: true, teamSeats: 1, whiteLabel: false, auditExport: false },
  growth: { label: "Growth", priceInr: 2_999, consentsPerMonth: 100_000, maxSites: 10, allLanguages: true, teamSeats: 3, whiteLabel: false, auditExport: true },
  scale: { label: "Scale", priceInr: 7_999, consentsPerMonth: 500_000, maxSites: Number.POSITIVE_INFINITY, allLanguages: true, teamSeats: 10, whiteLabel: true, auditExport: true },
};

/** The order shown on the pricing page. Starter is the entry tier. */
export const PLAN_ORDER: OrgPlan[] = ["starter", "growth", "scale"];
export const PAID_PLANS: OrgPlan[] = ["starter", "growth", "scale"];

export function getLimits(tier: OrgPlan): PlanLimits {
  return PLAN_LIMITS[tier] ?? PLAN_LIMITS.starter;
}

/** Team invites are a growth+ feature (teamSeats > 1). */
export function planAllowsTeam(tier: OrgPlan): boolean {
  return getLimits(tier).teamSeats > 1;
}

export function isUnlimited(n: number): boolean {
  return !Number.isFinite(n);
}

/** Compact INR like "₹2,999". */
export function formatInr(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}
