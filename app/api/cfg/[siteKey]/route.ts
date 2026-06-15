import { after } from "next/server";
import { corsHeaders, preflight } from "@/lib/http/cors";
import { getSiteCfgByKey } from "@/lib/sites/by-key";
import { mergeBannerSettings, DEFAULT_PURPOSES, type CfgDataItem } from "@/lib/banner/settings";
import { childrenFromSettings } from "@/lib/children/settings";
import { contactFromSettings } from "@/lib/contact/settings";
import { listDataItems } from "@/lib/data-items/store";
import { getPublishedNoticeMeta } from "@/lib/notices/store";
import { getOrgWithEntitlement } from "@/lib/orgs/queries";
import { getLimits } from "@/lib/plans";
import { decideGeo } from "@/lib/consent-core/geo";
import { edgeCountry, requestOrigin } from "@/lib/consent/request-meta";
import { recordSiteLoad } from "@/lib/sites/ping";
import type { GeoMode } from "@/lib/consent-core/types";

export const runtime = "nodejs";

export function OPTIONS() {
  return preflight();
}

/**
 * Config + geo for skope.js. Edge-cacheable (60s, SWR). Returns the banner
 * theme, the purpose list, the published notice version, and a geo decision
 * computed from the Cloudflare country header against the site's geo mode.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ siteKey: string }> },
) {
  const { siteKey } = await params;
  const site = await getSiteCfgByKey(siteKey);
  if (!site || site.status === "archived") {
    return Response.json({ error: "Unknown site key." }, { status: 404, headers: corsHeaders });
  }

  const banner = mergeBannerSettings((site.settings as { banner?: unknown }).banner);
  const children = childrenFromSettings(site.settings);
  const contact = contactFromSettings(site.settings);
  // DPDP §6(3): the consent request must surface a DPO (where applicable) or
  // other authorised person to exercise rights. Prefer the DPO; otherwise the
  // grievance officer always present for DPDP completeness.
  const rightsContact =
    contact.dpoName || contact.dpoEmail
      ? { name: contact.dpoName, email: contact.dpoEmail, role: "Data Protection Officer" }
      : contact.grievanceName || contact.grievanceEmail
        ? { name: contact.grievanceName, email: contact.grievanceEmail, role: "Grievance Officer" }
        : null;
  const geo = decideGeo({ country: edgeCountry(request.headers), geoMode: site.geoMode as GeoMode });
  const noticeMeta = await getPublishedNoticeMeta(site.id);

  // Declared data items (DPDP §5), shown under each purpose in the manage view.
  const dataItems: CfgDataItem[] = (await listDataItems(site.id)).map((i) => ({
    key: i.key,
    name: i.name,
    purposeKey: i.purposeKey,
    ...(i.sourceLabel ? { source: i.sourceLabel } : {}),
  }));

  // White-label (hide "Secured by Skope") is a plan feature of the owning org.
  const ent = await getOrgWithEntitlement(site.orgId);
  const whiteLabel = ent ? getLimits(ent.entitlement.tier).whiteLabel : false;

  // Record this real load after the response is sent, it's our "is it live" signal.
  const origin = requestOrigin(request.headers);
  after(() => recordSiteLoad(siteKey, origin));

  const appBase = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return Response.json(
    {
      siteKey,
      banner,
      children: { childMode: children.childMode, directedAtChildren: children.directedAtChildren },
      rightsContact,
      purposes: DEFAULT_PURPOSES,
      dataItems,
      noticeVersion: noticeMeta.version,
      noticeChecksum: noticeMeta.checksum,
      defaultLanguage: site.defaultLanguage,
      geo,
      policyUrl: `${appBase}/p/${siteKey}/privacy`,
      preferencesUrl: `${appBase}/p/${siteKey}/preferences`,
      whiteLabel,
    },
    {
      headers: {
        ...corsHeaders,
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    },
  );
}
