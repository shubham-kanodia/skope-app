import { sql } from "@/lib/db/client";
import { getEntitlement, type OrgEntitlementInput } from "@/lib/entitlement";
import { getUsage, currentMonth, type UsageSummary } from "@/lib/usage";
import { sendEmail } from "@/lib/email/send";

/**
 * Usage dunning: scan every org and, at meaningful billing thresholds, email the
 * billing contact once (deduped per org/month/level via usage_alerts). The
 * banner is never affected, this only nudges the owner to upgrade.
 */
type Level = "warn80" | "over100" | "lapsed";

interface OrgRow extends OrgEntitlementInput {
  id: string;
  name: string;
  billing_email: string | null;
}

export async function runDunningSweep(): Promise<{ scanned: number; emailed: number }> {
  const orgs = (await sql`
    select id, name, billing_email, plan, trial_ends_at, is_founding_member,
           founding_number, comp_until, plan_active_until
    from orgs`) as unknown as OrgRow[];

  const month = currentMonth();
  let emailed = 0;

  for (const o of orgs) {
    const ent = getEntitlement(o);
    const usage = await getUsage(o.id, ent.tier);

    const levels: Level[] = [];
    if (!ent.unlocked) levels.push("lapsed");
    if (usage.overLimit) levels.push("over100");
    else if (usage.percent >= 80) levels.push("warn80");

    for (const level of levels) {
      // Insert-once dedupe: only email when this org/month/level is fresh.
      const inserted = await sql`
        insert into usage_alerts (org_id, month, level)
        values (${o.id}, ${month}, ${level})
        on conflict do nothing
        returning org_id`;
      if (inserted.length && o.billing_email) {
        try {
          await sendEmail(buildEmail(level, o.billing_email, usage));
          emailed++;
        } catch (err) {
          console.error("[dunning] email failed", o.id, level, err);
        }
      }
    }
  }

  return { scanned: orgs.length, emailed };
}

const APP = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function buildEmail(level: Level, to: string, usage: UsageSummary) {
  const billing = `${APP}/dashboard/billing`;
  const fmt = (n: number) => n.toLocaleString("en-IN");
  if (level === "lapsed") {
    return {
      to,
      subject: "Your Skope plan needs attention",
      text: `Your subscription has ended. Your consent banner stays live, but dashboard editing is paused until you pick a plan.\n\nChoose a plan: ${billing}`,
      html: `<p>Your subscription has ended. Your consent banner stays live, but dashboard editing is paused until you pick a plan.</p><p><a href="${billing}">Choose a plan</a></p>`,
    };
  }
  if (level === "over100") {
    return {
      to,
      subject: "You've passed this month's consent limit",
      text: `You've recorded ${fmt(usage.used)} of ${fmt(usage.limit)} consents this month. Your banner keeps working, upgrade to keep editing in the dashboard.\n\nUpgrade: ${billing}`,
      html: `<p>You've recorded <strong>${fmt(usage.used)}</strong> of ${fmt(usage.limit)} consents this month. Your banner keeps working, upgrade to keep editing in the dashboard.</p><p><a href="${billing}">Upgrade</a></p>`,
    };
  }
  return {
    to,
    subject: "You're at 80% of your monthly consents",
    text: `You've used ${fmt(usage.used)} of ${fmt(usage.limit)} consents this month. Consider upgrading before you hit the limit.\n\nPlans: ${billing}`,
    html: `<p>You've used <strong>${fmt(usage.used)}</strong> of ${fmt(usage.limit)} consents this month. Consider upgrading before you hit the limit.</p><p><a href="${billing}">See plans</a></p>`,
  };
}
