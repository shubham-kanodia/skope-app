import { randomBytes } from "node:crypto";
import { sql } from "@/lib/db/client";
import { getEntitlement, type Entitlement, type OrgEntitlementInput } from "@/lib/entitlement";
import { writeAudit } from "@/lib/audit/write";

export interface Org extends OrgEntitlementInput {
  id: string;
  name: string;
  billing_email: string | null;
  referral_code: string | null;
}

export interface Site {
  id: string;
  domain: string;
  site_key: string;
  status: string;
  geo_mode: string;
  created_at: string;
}

export async function getOrg(orgId: string): Promise<Org | null> {
  const rows = await sql`
    select id, name, billing_email, plan, trial_ends_at, is_founding_member, founding_number,
           comp_until, plan_active_until, referral_code
    from orgs where id = ${orgId} limit 1`;
  return (rows[0] as Org | undefined) ?? null;
}

export async function getOrgWithEntitlement(
  orgId: string,
): Promise<{ org: Org; entitlement: Entitlement } | null> {
  const org = await getOrg(orgId);
  if (!org) return null;
  return { org, entitlement: getEntitlement(org) };
}

export interface SiteWithSettings extends Site {
  settings: Record<string, unknown>;
  last_seen_at: string | null;
  last_seen_origin: string | null;
}

/** Fetch a single site scoped to its org (authorization check baked in). */
export async function getSiteForOrg(siteId: string, orgId: string): Promise<SiteWithSettings | null> {
  const rows = await sql`
    select id, domain, site_key, status, geo_mode, created_at, settings, last_seen_at, last_seen_origin
    from sites where id = ${siteId} and org_id = ${orgId} limit 1`;
  if (!rows[0]) return null;
  return {
    ...(rows[0] as unknown as Site),
    settings: (rows[0].settings ?? {}) as Record<string, unknown>,
    last_seen_at: (rows[0].last_seen_at as string | null) ?? null,
    last_seen_origin: (rows[0].last_seen_origin as string | null) ?? null,
  };
}

export async function listSites(orgId: string): Promise<Site[]> {
  const rows = await sql`
    select id, domain, site_key, status, geo_mode, created_at
    from sites where org_id = ${orgId} order by created_at desc`;
  return rows as unknown as Site[];
}

export interface SiteForSetup {
  id: string;
  domain: string;
  site_key: string;
  settings: Record<string, unknown>;
  last_seen_at: string | null;
}

/** Sites with the fields the dashboard needs to compute onboarding progress. */
export async function listSitesForSetup(orgId: string): Promise<SiteForSetup[]> {
  const rows = await sql`
    select id, domain, site_key, settings, last_seen_at
    from sites where org_id = ${orgId} order by created_at desc`;
  return rows.map((r) => ({
    id: r.id as string,
    domain: r.domain as string,
    site_key: r.site_key as string,
    settings: (r.settings ?? {}) as Record<string, unknown>,
    last_seen_at: (r.last_seen_at as string | null) ?? null,
  }));
}

function generateSiteKey(): string {
  return `sk_live_${randomBytes(16).toString("hex")}`;
}

/** Create a site under an org. Returns the new site (with its generated key). */
export async function createSite(
  orgId: string,
  actorUserId: string,
  domain: string,
): Promise<Site> {
  const siteKey = generateSiteKey();
  return sql.begin(async (tx) => {
    const rows = await tx`
      insert into sites (org_id, domain, site_key)
      values (${orgId}, ${domain}, ${siteKey})
      returning id, domain, site_key, status, geo_mode, created_at`;
    await writeAudit({ orgId, actorUserId, action: "site.created", target: domain }, tx);
    return rows[0] as unknown as Site;
  });
}
