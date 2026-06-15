import { getSession } from "@/lib/auth/session";
import { getRequestForOrg } from "@/lib/requests/store";
import { getSiteForOrg, getOrg } from "@/lib/orgs/queries";
import { listDataItems } from "@/lib/data-items/store";
import { listRecipients } from "@/lib/recipients/store";
import { contactFromSettings } from "@/lib/contact/settings";
import { buildAccessSummaryPdf } from "@/lib/requests/access-response";
import { writeAudit } from "@/lib/audit/write";

export const runtime = "nodejs";

/**
 * Generate the §11(1) access-request summary PDF for a request. Assembles the
 * site's declared data items, purposes, recipients, and contacts into a
 * deliverable the fiduciary sends to the (identity-verified) requester. The
 * fiduciary is responsible for verifying the requester's identity before sending.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in to do this." }, { status: 401 });

  const req = await getRequestForOrg(session.orgId, id);
  if (!req) return Response.json({ error: "Request not found." }, { status: 404 });
  if (req.type !== "access") {
    return Response.json({ error: "Only access requests have a data summary." }, { status: 400 });
  }

  const site = await getSiteForOrg(req.siteId, session.orgId);
  if (!site) return Response.json({ error: "Site not found." }, { status: 404 });

  const [org, dataItems, recipients] = await Promise.all([
    getOrg(session.orgId),
    listDataItems(req.siteId),
    listRecipients(req.siteId),
  ]);
  const contact = contactFromSettings(site.settings);

  const pdf = buildAccessSummaryPdf({
    orgName: contact.entityName || (org && org.name !== "My workspace" ? org.name : "") || site.domain,
    domain: site.domain,
    requesterEmail: req.email,
    dataItems,
    recipients,
    contact,
  });

  await writeAudit({ orgId: session.orgId, actorUserId: session.userId, action: "access.respond", target: id });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="access-summary-${req.domain}-${new Date().toISOString().slice(0, 10)}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
