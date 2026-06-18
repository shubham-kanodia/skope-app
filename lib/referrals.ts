import { randomBytes } from "node:crypto";
import type postgres from "postgres";
import { sql } from "@/lib/db/client";

/**
 * Referrals: the referrer gets days added to their active window when a new org
 * signs up with their code. Rewarded at referee signup.
 */
export const REFERRAL_REFERRER_BONUS_DAYS = 30;

/**
 * A sql client or an in-transaction sql tag. TransactionSql is the narrower of
 * the two, so the plain client (Sql, which has more members) is also assignable.
 */
type Db = postgres.TransactionSql<Record<string, never>>;

export function generateReferralCode(): string {
  return randomBytes(8).toString("base64url").replace(/[-_]/g, "").slice(0, 8).toLowerCase();
}

/**
 * Extend an org's active entitlement window by `days`: founding → comp_until;
 * active paid subscription → plan_active_until. An inactive (read-only) org has
 * no live window to extend, so the reward is skipped — the referral is still
 * recorded for the audit trail.
 */
export async function applyReferralReward(db: Db, orgId: string, days: number): Promise<void> {
  const rows = await db`
    select is_founding_member, comp_until, plan_active_until
    from orgs where id = ${orgId} limit 1`;
  const o = rows[0];
  if (!o) return;
  const now = Date.now();
  const foundingActive = o.is_founding_member && o.comp_until && new Date(o.comp_until as string).getTime() > now;
  const paidActive = o.plan_active_until != null && new Date(o.plan_active_until as string).getTime() > now;

  if (foundingActive) {
    await db`update orgs set comp_until = comp_until + make_interval(days => ${days}) where id = ${orgId}`;
  } else if (paidActive) {
    await db`update orgs set plan_active_until = plan_active_until + make_interval(days => ${days}) where id = ${orgId}`;
  }
}

/** Record the referral (deduped on referee). */
export async function recordReferral(
  db: Db,
  referrerOrgId: string,
  refereeOrgId: string,
  rewardDays: number,
): Promise<void> {
  await db`
    insert into referrals (referrer_org_id, referee_org_id, reward_days)
    values (${referrerOrgId}, ${refereeOrgId}, ${rewardDays})
    on conflict (referee_org_id) do nothing`;
}

export interface ReferralStats {
  count: number;
  bonusDays: number;
}

export async function getReferralStats(orgId: string): Promise<ReferralStats> {
  const rows = await sql`
    select count(*)::int as c, coalesce(sum(reward_days), 0)::int as d
    from referrals where referrer_org_id = ${orgId}`;
  return { count: (rows[0]?.c as number) ?? 0, bonusDays: (rows[0]?.d as number) ?? 0 };
}
