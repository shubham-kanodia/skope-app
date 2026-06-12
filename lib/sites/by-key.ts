import { sql } from "@/lib/db/client";

export interface SiteRef {
  id: string;
  orgId: string;
  status: string;
}

/** Resolve a public site_key to its site. Used by the unauthenticated edge APIs. */
export async function getSiteByKey(siteKey: string): Promise<SiteRef | null> {
  const rows = await sql`select id, org_id, status from sites where site_key = ${siteKey} limit 1`;
  if (!rows[0]) return null;
  return { id: rows[0].id as string, orgId: rows[0].org_id as string, status: rows[0].status as string };
}

export interface SiteCfgRow {
  id: string;
  orgId: string;
  status: string;
  geoMode: string;
  defaultLanguage: string;
  enabledLanguages: string[];
  settings: Record<string, unknown>;
}

export interface PublicSite {
  id: string;
  orgId: string;
  orgName: string;
  domain: string;
  status: string;
  defaultLanguage: string;
  enabledLanguages: string[];
  settings: Record<string, unknown>;
}

/**
 * Public-facing site identity for the hosted privacy + preferences pages.
 * Joins the org name in so the notice can name the Data Fiduciary. No auth, the
 * site_key is the public handle.
 */
export async function getPublicSiteByKey(siteKey: string): Promise<PublicSite | null> {
  const rows = await sql`
    select s.id, s.org_id, o.name as org_name, s.domain, s.status,
           s.default_language, s.enabled_languages, s.settings
    from sites s join orgs o on o.id = s.org_id
    where s.site_key = ${siteKey} limit 1`;
  if (!rows[0]) return null;
  return {
    id: rows[0].id as string,
    orgId: rows[0].org_id as string,
    orgName: rows[0].org_name as string,
    domain: rows[0].domain as string,
    status: rows[0].status as string,
    defaultLanguage: rows[0].default_language as string,
    enabledLanguages: (rows[0].enabled_languages ?? []) as string[],
    settings: (rows[0].settings ?? {}) as Record<string, unknown>,
  };
}

/** Full config a site needs for skope.js / the cfg endpoint. */
export async function getSiteCfgByKey(siteKey: string): Promise<SiteCfgRow | null> {
  const rows = await sql`
    select id, org_id, status, geo_mode, default_language, enabled_languages, settings
    from sites where site_key = ${siteKey} limit 1`;
  if (!rows[0]) return null;
  return {
    id: rows[0].id as string,
    orgId: rows[0].org_id as string,
    status: rows[0].status as string,
    geoMode: rows[0].geo_mode as string,
    defaultLanguage: rows[0].default_language as string,
    enabledLanguages: (rows[0].enabled_languages ?? []) as string[],
    settings: (rows[0].settings ?? {}) as Record<string, unknown>,
  };
}
