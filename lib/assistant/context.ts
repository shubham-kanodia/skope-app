import { sql } from "@/lib/db/client";
import { getOrgWithEntitlement, listSitesForSetup } from "@/lib/orgs/queries";
import { getSetupState } from "@/lib/sites/setup";
import { listDataItems } from "@/lib/data-items/store";
import { countReceiptsForOrg } from "@/lib/consent/list";
import { getLimits } from "@/lib/plans";

/**
 * Compact text snapshot of the org's compliance state, injected into the
 * assistant's system prompt so answers reference their actual setup ("your
 * notice on acme.in is unpublished") instead of generic advice. Recomputed per
 * request, nothing persisted. Kept to a few KB.
 */
export async function buildOrgContext(orgId: string): Promise<string> {
  const [data, sites, receiptCount] = await Promise.all([
    getOrgWithEntitlement(orgId),
    listSitesForSetup(orgId),
    countReceiptsForOrg(orgId),
  ]);

  const lines: string[] = [];
  if (data) {
    const ent = data.entitlement;
    lines.push(
      `Organisation: ${data.org.name} (access tier: ${getLimits(ent.tier).label}, status: ${ent.status}${
        ent.banner ? `, "${ent.banner}"` : ""
      })`,
    );
  }
  lines.push(`Consent receipts recorded: ${receiptCount}`);

  // Open rights requests by type, with overdue counts.
  const reqRows = (await sql`
    select r.type, count(*)::int as n,
           count(*) filter (where r.due_at < now())::int as overdue
    from requests r join sites s on s.id = r.site_id
    where s.org_id = ${orgId} and r.status in ('new', 'in_progress')
    group by r.type`) as Array<{ type: string; n: number; overdue: number }>;
  lines.push(
    reqRows.length
      ? `Open rights requests: ${reqRows.map((r) => `${r.n} ${r.type}${r.overdue ? ` (${r.overdue} OVERDUE)` : ""}`).join(", ")}`
      : "Open rights requests: none",
  );

  for (const site of sites.slice(0, 5)) {
    const setup = await getSetupState(site.id, site.settings, site.last_seen_at);
    const todo = setup.steps.filter((s) => !s.done).map((s) => s.label);
    const items = await listDataItems(site.id);
    lines.push(
      `Site ${site.domain}: setup ${setup.percent}% complete` +
        (todo.length ? ` (still to do: ${todo.join("; ")})` : "") +
        (items.length
          ? `; declared data items: ${items.map((i) => i.name.en ?? i.key).join(", ")}`
          : "; no data items declared yet"),
    );
  }
  if (sites.length === 0) lines.push("No sites added yet.");
  if (sites.length > 5) lines.push(`(and ${sites.length - 5} more sites)`);

  return lines.join("\n").slice(0, 3000);
}
