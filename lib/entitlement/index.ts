/**
 * Entitlement, the single source of truth for "what is this org allowed to do".
 *
 * Commercial rules, encoded once here and read everywhere (banner, feature
 * gates, checkout):
 *   1. Launch offer: anyone signing up before LAUNCH_OFFER_SIGNUP_DEADLINE
 *      gets LAUNCH_OFFER_MONTHS months of compliance free (Growth-level).
 *   2. Payments are paused until PAYMENTS_PAUSED_UNTIL — no checkout, no
 *      upgrade nudges with a price on them.
 *   3. Every new org also gets a 30-day trial (matters only after the offer
 *      window closes).
 *   4. Legacy: early orgs created under the old "first 50 founding members"
 *      program keep their 2-year comp (read path only; no new ones).
 */

export const TRIAL_DAYS = 30;

/** Sign up before this and compliance is free for LAUNCH_OFFER_MONTHS. */
export const LAUNCH_OFFER_SIGNUP_DEADLINE = new Date("2026-07-12T23:59:59+05:30");
export const LAUNCH_OFFER_MONTHS = 6;
/** No payments are taken before this date; plans can't be purchased. */
export const PAYMENTS_PAUSED_UNTIL = new Date("2026-08-12T00:00:00+05:30");

export function isLaunchOfferOpen(now = new Date()): boolean {
  return now <= LAUNCH_OFFER_SIGNUP_DEADLINE;
}

export function arePaymentsPaused(now = new Date()): boolean {
  return now < PAYMENTS_PAUSED_UNTIL;
}

export type OrgPlan = "free" | "starter" | "growth" | "scale";

/** The columns getEntitlement needs, a subset of the orgs row. */
export interface OrgEntitlementInput {
  plan: OrgPlan;
  trial_ends_at: Date | string | null;
  is_founding_member: boolean;
  founding_number: number | null;
  comp_until: Date | string | null;
  /** When a paid subscription lapses; null = active (manual/comp grant). */
  plan_active_until?: Date | string | null;
}

export type EntitlementStatus = "launch" | "founding" | "trial" | "paid" | "free";

export interface Entitlement {
  status: EntitlementStatus;
  /** Tier used for plan-limit lookups. Founding/trial unlock paid-equivalent limits. */
  tier: OrgPlan;
  /** Whether paid-tier features are unlocked right now. */
  unlocked: boolean;
  /** When the current founding/trial window ends (null for plain free/paid). */
  activeUntil: Date | null;
  /** Whole days remaining in the founding/trial window (null otherwise). */
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
 * Compute the entitlement fields for a brand-new org. While the launch offer
 * is open, every signup gets LAUNCH_OFFER_MONTHS of comp (comp_until set,
 * founding flags off — "founding member" is a legacy program we no longer
 * assign). After the window closes, signups get the plain 30-day trial.
 * `foundingNumber` (from nextval) is accepted for call-site compatibility but
 * no longer grants anything.
 */
export function newOrgEntitlement(_foundingNumber: number, now = new Date()) {
  const trialEnds = new Date(now.getTime() + TRIAL_DAYS * 86_400_000);
  const compUntil = isLaunchOfferOpen(now)
    ? new Date(new Date(now).setMonth(now.getMonth() + LAUNCH_OFFER_MONTHS))
    : null;
  return {
    trial_ends_at: trialEnds,
    is_founding_member: false,
    founding_number: null as number | null,
    comp_until: compUntil,
  };
}

const YEAR_FMT = new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" });

export function getEntitlement(org: OrgEntitlementInput, now = new Date()): Entitlement {
  const comp = toDate(org.comp_until);
  const trial = toDate(org.trial_ends_at);

  // 1a. Launch-offer comp window (comp_until without the legacy founding flag).
  if (!org.is_founding_member && comp && comp > now) {
    return {
      status: "launch",
      tier: "growth",
      unlocked: true,
      activeUntil: comp,
      daysLeft: daysBetween(now, comp),
      banner: `Launch offer: everything's free for early members until ${YEAR_FMT.format(comp)}.`,
    };
  }

  // 1b. Legacy founding member with live comp window.
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

  // 2. Paying customer, while the subscription is active (null = manual/comp
  // grant). Checked before the trial so paying during a trial unlocks the paid
  // tier immediately.
  if (org.plan !== "free") {
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
    // Subscription lapsed → fall through to trial (if any) / free below.
  }

  // 3. Active trial.
  if (trial && trial > now) {
    const left = daysBetween(now, trial);
    return {
      status: "trial",
      tier: "growth",
      unlocked: true,
      activeUntil: trial,
      daysLeft: left,
      banner:
        left === 1
          ? "Last day of your free trial. Add a plan to keep your banner live."
          : `${left} days left in your free trial.`,
    };
  }

  // 4. Free tier (trial ended, no plan). Banner still works; limits apply.
  return {
    status: "free",
    tier: "free",
    unlocked: false,
    activeUntil: null,
    daysLeft: null,
    banner: "Your trial has ended. You're on the free plan, upgrade for more consents and all languages.",
  };
}
