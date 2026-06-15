import { sql } from "@/lib/db/client";
import { writeAudit } from "@/lib/audit/write";
import { openObligation } from "@/lib/erasure/store";
import { retentionFromSettings } from "./settings";

/**
 * Retention sweep (DPDP §8(8) → §8(7)): for each active site, find principals
 * whose most recent consent activity is older than the site's inactivity window
 *, the purpose is "no longer served", and open an erasure obligation so the
 * fiduciary erases or anonymises the data. Idempotent: a re-run updates the
 * existing open obligation rather than duplicating it (partial unique index on
 * site+subject+kind). Withdrawals are handled at write time, not here.
 */
export interface SweepResult {
  sitesScanned: number;
  obligationsOpened: number;
}

export async function runRetentionSweep(): Promise<SweepResult> {
  const sites = await sql<{ id: string; org_id: string; settings: Record<string, unknown> | null }[]>`
    select id, org_id, settings from sites where status = 'active'`;

  let obligationsOpened = 0;

  for (const site of sites) {
    const windowDays = retentionFromSettings(site.settings ?? {}).inactivityDays;
    const cutoff = new Date(Date.now() - windowDays * 86_400_000);

    // Latest receipt per subject for this site. A subject whose latest action is
    // already a withdrawal has its obligation from the write hook; skip those.
    const latest = await sql<{ subject_id: string; occurred_at: string; action: string }[]>`
      select distinct on (subject_id) subject_id, occurred_at, action
      from consent_receipts
      where site_id = ${site.id} and subject_id is not null
      order by subject_id, occurred_at desc`;

    let openedHere = 0;
    for (const row of latest) {
      if (row.action === "withdraw" || row.action === "withdraw_all") continue;
      if (new Date(row.occurred_at) >= cutoff) continue;
      const { created } = await openObligation({
        siteId: site.id,
        subjectId: row.subject_id,
        kind: "inactivity",
        sourceAction: row.action,
        basis: `No consent activity for over ${windowDays} days, purpose no longer served (DPDP §8(8)).`,
        dueAt: new Date(),
      });
      if (created) openedHere += 1;
    }

    if (openedHere > 0) {
      obligationsOpened += openedHere;
      await writeAudit({
        orgId: site.org_id,
        action: "erasure.sweep",
        target: site.id,
        diff: { opened: openedHere, windowDays },
      });
    }
  }

  return { sitesScanned: sites.length, obligationsOpened };
}
