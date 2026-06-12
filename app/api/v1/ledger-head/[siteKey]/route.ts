import { corsHeaders, preflight } from "@/lib/http/cors";
import { getSiteByKey } from "@/lib/sites/by-key";
import { ledgerHead } from "@/lib/consent/verify";

export const runtime = "nodejs";

export function OPTIONS() {
  return preflight();
}

/**
 * Public transparency anchor: the latest head hash for a site's consent chain.
 * A third party can record this and later detect tampering. No PII is exposed.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ siteKey: string }> },
) {
  const { siteKey } = await params;
  const site = await getSiteByKey(siteKey);
  if (!site) {
    return Response.json({ error: "Unknown site key." }, { status: 404, headers: corsHeaders });
  }
  const head = await ledgerHead(site.id);
  return Response.json({ siteKey, ...head }, { headers: corsHeaders });
}
