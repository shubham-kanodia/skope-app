import { requireSession } from "@/lib/auth/guard";
import { getOrgGate } from "@/lib/billing/gate";
import {
  arePaymentsPaused,
  isLaunchOfferOpen,
  LAUNCH_OFFER_MONTHS,
  LAUNCH_OFFER_SIGNUP_DEADLINE,
  PAYMENTS_PAUSED_UNTIL,
} from "@/lib/entitlement";
import { PLAN_ORDER, PLAN_LIMITS, getLimits, formatInr, isUnlimited } from "@/lib/plans";
import { getReferralStats } from "@/lib/referrals";
import { Callout } from "@/components/ui/callout";
import { UsageMeter } from "@/components/billing/usage-meter";
import { PlanCards, type PlanCardData } from "@/components/billing/plan-cards";
import { ReferralCard } from "@/components/billing/referral-card";

const DAY_FMT = new Intl.DateTimeFormat("en-IN", { dateStyle: "long" });

export default async function BillingPage() {
  const session = await requireSession();
  const gate = await getOrgGate(session.orgId);
  if (!gate) return null;

  const stats = await getReferralStats(session.orgId);

  const cards: PlanCardData[] = PLAN_ORDER.map((plan) => {
    const l = PLAN_LIMITS[plan];
    return {
      plan,
      label: l.label,
      priceLabel: formatInr(l.priceInr),
      features: [
        `${l.consentsPerMonth.toLocaleString("en-IN")} consents/mo`,
        isUnlimited(l.maxSites) ? "Unlimited sites" : `${l.maxSites} site${l.maxSites === 1 ? "" : "s"}`,
        "All Indian languages",
        l.teamSeats > 1 ? `${l.teamSeats} team seats` : "Single user",
        ...(l.whiteLabel ? ["No Skope branding"] : []),
      ],
      current: gate.entitlement.tier === plan,
    };
  });

  const appBase = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const link = `${appBase}/login?ref=${gate.org.referral_code ?? ""}`;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[2rem] leading-tight">Billing</h1>
        <p className="mt-1 text-body">
          {gate.entitlement.banner || `You're on the ${getLimits(gate.entitlement.tier).label} plan.`}
        </p>
      </div>

      {arePaymentsPaused() && (
        <Callout tone="info" title="Skope is free for everyone right now">
          {isLaunchOfferOpen()
            ? `Sign-ups before ${DAY_FMT.format(LAUNCH_OFFER_SIGNUP_DEADLINE)} get ${LAUNCH_OFFER_MONTHS} months of Growth-level access free. `
            : ""}
          Payments open on {DAY_FMT.format(PAYMENTS_PAUSED_UNTIL)}, until then there is nothing to
          pay and nothing to set up. The plans below are what pricing will look like later.
        </Callout>
      )}

      <UsageMeter usage={gate.usage} />

      <div>
        <h2 className="mb-3 text-lg text-ink">Plans</h2>
        <PlanCards cards={cards} isOwner={session.role === "owner"} paused={arePaymentsPaused()} />
        <p className="mt-3 text-xs text-muted">
          Launch-offer orgs and trials get Growth-level limits. Prices are introductory and may change.
        </p>
      </div>

      <ReferralCard link={link} count={stats.count} bonusDays={stats.bonusDays} />
    </div>
  );
}
