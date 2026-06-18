import { requireSession } from "@/lib/auth/guard";
import { getOrgGate } from "@/lib/billing/gate";
import { PLAN_ORDER, PLAN_LIMITS, getLimits, formatInr, isUnlimited } from "@/lib/plans";
import { getReferralStats } from "@/lib/referrals";
import { UsageMeter } from "@/components/billing/usage-meter";
import { PlanCards, type PlanCardData } from "@/components/billing/plan-cards";
import { ReferralCard } from "@/components/billing/referral-card";

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

      <UsageMeter usage={gate.usage} />

      <div>
        <h2 className="mb-3 text-lg text-ink">Plans</h2>
        <PlanCards cards={cards} isOwner={session.role === "owner"} />
        <p className="mt-3 text-xs text-muted">Prices are introductory and may change.</p>
      </div>

      <ReferralCard link={link} count={stats.count} bonusDays={stats.bonusDays} />
    </div>
  );
}
