import { sql } from "@/lib/db/client";
import { getLimits } from "@/lib/plans";
import type { OrgPlan } from "@/lib/entitlement";

/** Current billing month, UTC, matching how usage_counters.month is written. */
export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

/** Total consent events recorded across an org's sites this month. */
export async function getMonthlyConsents(orgId: string, month = currentMonth()): Promise<number> {
  const rows = await sql`
    select coalesce(sum(u.consent_events), 0)::int as n
    from usage_counters u
    join sites s on s.id = u.site_id
    where s.org_id = ${orgId} and u.month = ${month}`;
  return (rows[0]?.n as number) ?? 0;
}

export interface UsageSummary {
  used: number;
  limit: number;
  percent: number; // 0..100, clamped
  overLimit: boolean;
}

export async function getUsage(orgId: string, tier: OrgPlan): Promise<UsageSummary> {
  const used = await getMonthlyConsents(orgId);
  const limit = getLimits(tier).consentsPerMonth;
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return { used, limit, percent, overLimit: used > limit };
}
