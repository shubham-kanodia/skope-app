import { requireSession } from "@/lib/auth/guard";
import { getSiteForOrg } from "@/lib/orgs/queries";
import { assertPublicUrl } from "@/lib/http/ssrf";
import { hostMatchesDomain } from "@/lib/sites/ping";

export const runtime = "nodejs";

const MAX_BYTES = 512 * 1024;
const SEEN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // "live" if we saw a load in the last 7 days

/**
 * Is skope.js live on a site?
 *
 * Primary signal: have we actually received a load (a /api/cfg call) from the
 * page recently? That proves the script ran, works on localhost, and tells us
 * which domain it ran on, so we can flag a mismatch with the registered domain.
 *
 * Fallback: if we've never seen a load, fetch the registered domain (SSRF-guarded)
 * and grep for the tag, useful before the first real visitor.
 */
export async function POST(request: Request) {
  const session = await requireSession();

  let body: { siteId?: string; url?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const site = body.siteId ? await getSiteForOrg(body.siteId, session.orgId) : null;
  if (!site) return Response.json({ error: "Site not found." }, { status: 404 });

  // --- primary: observed load ---
  const lastSeenAt = site.last_seen_at;
  const observedOrigin = site.last_seen_origin;
  const recentlySeen = !!lastSeenAt && Date.now() - new Date(lastSeenAt).getTime() < SEEN_WINDOW_MS;

  let observedHost: string | null = null;
  let domainMatch: boolean | null = null;
  if (observedOrigin) {
    try {
      observedHost = new URL(observedOrigin).host;
      domainMatch = hostMatchesDomain(observedHost, site.domain);
    } catch {
      /* origin "null" or malformed */
    }
  }

  if (recentlySeen) {
    return Response.json({
      live: true,
      source: "observed",
      registeredDomain: site.domain,
      lastSeenAt,
      observedOrigin,
      observedHost,
      domainMatch,
    });
  }

  // --- fallback: fetch the registered domain (or a URL you pass) and grep ---
  const target = body.url?.trim() || `https://${site.domain}`;
  let url;
  try {
    url = await assertPublicUrl(target);
  } catch (err) {
    return Response.json({
      live: false,
      source: "none",
      registeredDomain: site.domain,
      lastSeenAt,
      observedOrigin,
      observedHost,
      domainMatch,
      error: (err as Error).message,
    });
  }

  let installed = false;
  let fetchError: string | undefined;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "SkopeInstallCheck/1.0 (+https://skope.network)" },
    }).finally(() => clearTimeout(timer));
    if (!res.ok) {
      fetchError = `Your site returned ${res.status}.`;
    } else {
      const html = (await res.text()).slice(0, MAX_BYTES);
      const keyEsc = site.site_key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const hasKey = new RegExp(`data-site\\s*=\\s*["']?${keyEsc}`).test(html);
      installed = hasKey && /skope\.js/.test(html);
      if (!installed) {
        fetchError = "We didn't find the Skope tag on that page yet. Add it, deploy, then check again.";
      }
    }
  } catch {
    fetchError = "We couldn't reach your site. If it's local or behind a login, just open it in a browser, we detect real loads automatically.";
  }

  return Response.json({
    live: installed,
    source: installed ? "fetched" : "none",
    registeredDomain: site.domain,
    checkedUrl: url.toString(),
    lastSeenAt,
    observedOrigin,
    observedHost,
    domainMatch,
    error: installed ? undefined : fetchError,
  });
}
