import { sql } from "@/lib/db/client";

/** A site counts as "live" if we observed a real load within this window. */
export const SEEN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Did skope.js load on this site recently enough to call it live? */
export function isRecentlySeen(lastSeenAt: string | null | undefined): boolean {
  return !!lastSeenAt && Date.now() - new Date(lastSeenAt).getTime() < SEEN_WINDOW_MS;
}

/**
 * Record that skope.js loaded on a real page (called from /api/cfg via after()).
 * Best-effort, never block or fail the cfg response over this.
 */
export async function recordSiteLoad(siteKey: string, origin: string | null): Promise<void> {
  try {
    await sql`
      update sites set last_seen_at = now(), last_seen_origin = ${origin}
      where site_key = ${siteKey}`;
  } catch (err) {
    console.error("[ping] failed to record site load", err);
  }
}

/**
 * Does an observed origin host belong to the registered domain? Lenient:
 * exact, www., or any subdomain of the registered apex all count as a match.
 */
export function hostMatchesDomain(observedHost: string, domain: string): boolean {
  const host = observedHost.toLowerCase().replace(/:\d+$/, ""); // drop port
  const d = domain.toLowerCase();
  return host === d || host === `www.${d}` || host.endsWith(`.${d}`);
}
