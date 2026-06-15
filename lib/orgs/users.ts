import { sql } from "@/lib/db/client";
import { newOrgEntitlement } from "@/lib/entitlement";
import { writeAudit } from "@/lib/audit/write";
import type { UserRole } from "@/lib/auth/session";
import {
  generateReferralCode,
  applyReferralReward,
  recordReferral,
  REFERRAL_REFEREE_BONUS_DAYS,
  REFERRAL_REFERRER_BONUS_DAYS,
} from "@/lib/referrals";

export interface ResolvedUser {
  userId: string;
  orgId: string;
  isNew: boolean;
  role: UserRole;
}

function defaultOrgName(email: string): string {
  const domain = email.split("@")[1];
  if (domain && !COMMON_MAILBOXES.has(domain)) return domain;
  return "My workspace";
}

const COMMON_MAILBOXES = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "yahoo.com",
  "yahoo.in",
  "icloud.com",
  "proton.me",
  "rediffmail.com",
]);

/**
 * Find the user for this email, or create a fresh org + owner user.
 *
 * New-org creation runs in one transaction so the founding-member slot
 * (nextval) and the org/user/audit rows commit atomically, no window where
 * a number is taken but the org isn't created.
 */
export async function findOrCreateUserByEmail(
  emailRaw: string,
  refCode?: string | null,
): Promise<ResolvedUser> {
  const email = emailRaw.trim().toLowerCase();

  const existing = await sql`select id, org_id, role from users where email = ${email} limit 1`;
  if (existing[0]) {
    return {
      userId: existing[0].id as string,
      orgId: existing[0].org_id as string,
      isNew: false,
      role: existing[0].role as UserRole,
    };
  }

  return sql.begin(async (tx) => {
    // A pending team invite to this email → join that org (proven by the magic
    // link to the invited address), instead of creating a brand-new org.
    const invite = await tx`
      select id, org_id, role from org_invites
      where lower(email) = ${email} and accepted_at is null and expires_at > now()
      order by created_at desc limit 1`;
    if (invite[0]) {
      const orgId = invite[0].org_id as string;
      const role = invite[0].role as UserRole;
      const userRows = await tx`
        insert into users (org_id, email, role) values (${orgId}, ${email}, ${role}) returning id`;
      const userId = userRows[0].id as string;
      await tx`update org_invites set accepted_at = now() where id = ${invite[0].id}`;
      await writeAudit({ orgId, actorUserId: userId, action: "member.joined", target: email }, tx);
      return { userId, orgId, isNew: true, role } satisfies ResolvedUser;
    }

    const seqRows = await tx`select nextval('founding_member_seq') as n`;
    const ent = newOrgEntitlement(Number(seqRows[0].n));

    // Referral: a valid code (not yet usable for self-referral, the new org
    // doesn't exist) gives the new org bonus trial days and rewards the referrer.
    let referrerId: string | null = null;
    if (refCode) {
      const ref = await tx`select id from orgs where referral_code = ${refCode.trim().toLowerCase()} limit 1`;
      referrerId = (ref[0]?.id as string | undefined) ?? null;
    }
    const trialEnds = referrerId
      ? new Date(new Date(ent.trial_ends_at).getTime() + REFERRAL_REFEREE_BONUS_DAYS * 86_400_000)
      : ent.trial_ends_at;

    const orgRows = await tx`
      insert into orgs (name, billing_email, trial_ends_at, is_founding_member, founding_number,
                        comp_until, referral_code, referred_by_org_id)
      values (${defaultOrgName(email)}, ${email}, ${trialEnds},
              ${ent.is_founding_member}, ${ent.founding_number}, ${ent.comp_until},
              ${generateReferralCode()}, ${referrerId})
      returning id`;
    const orgId = orgRows[0].id as string;

    const userRows = await tx`
      insert into users (org_id, email, role) values (${orgId}, ${email}, 'owner') returning id`;
    const userId = userRows[0].id as string;

    await writeAudit(
      {
        orgId,
        actorUserId: userId,
        action: "org.created",
        target: orgId,
        diff: { founding_number: ent.founding_number, is_founding_member: ent.is_founding_member },
      },
      tx,
    );

    if (referrerId) {
      await recordReferral(tx, referrerId, orgId, REFERRAL_REFERRER_BONUS_DAYS);
      await applyReferralReward(tx, referrerId, REFERRAL_REFERRER_BONUS_DAYS);
    }

    return { userId, orgId, isNew: true, role: "owner" } satisfies ResolvedUser;
  });
}
