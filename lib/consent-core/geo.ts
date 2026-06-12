import type { GeoDecision, GeoMode, NonTargetBehavior } from "./types";

/**
 * Decide whether a visitor sees the banner, based on the site's geo mode and
 * the country resolved at the edge (Cloudflare `cf-ipcountry`).
 *
 *   india_only (default): banner only for India. DPDP obligations attach to
 *                         Indian data principals; global users stay untouched.
 *   global:               banner for everyone.
 *   custom:               banner only for countries in the allowlist.
 *
 * Fallback: when country is unknown (rare), treat as India (safe default) so we
 * never silently skip an obligation. Timezone is only a tiebreaker upstream.
 */
export function decideGeo(params: {
  country: string | null | undefined;
  geoMode: GeoMode;
  customAllowlist?: string[];
  nonTargetBehavior?: NonTargetBehavior;
}): GeoDecision {
  const region = (params.country ?? "IN").toUpperCase();
  const nonTargetBehavior = params.nonTargetBehavior ?? "allow_all";

  let showBanner: boolean;
  switch (params.geoMode) {
    case "global":
      showBanner = true;
      break;
    case "custom":
      showBanner = (params.customAllowlist ?? []).map((c) => c.toUpperCase()).includes(region);
      break;
    case "india_only":
    default:
      showBanner = region === "IN";
      break;
  }

  return { region, showBanner, nonTargetBehavior };
}
