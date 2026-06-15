import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/guard";
import { getSiteForOrg, listSites } from "@/lib/orgs/queries";
import { contactFromSettings, DEFAULT_CONTACT_SETTINGS, type ContactSettings } from "@/lib/contact/settings";
import { getIncident, listNotifications } from "@/lib/breach/store";
import { boardBreachNotice, principalBreachNotice } from "@/lib/breach/notice-template";
import type { BreachRow } from "@/lib/breach/types";
import { BreachDetail } from "../breach-detail";

const when = new Intl.DateTimeFormat("en-IN", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Kolkata" });

async function contactForIncident(orgId: string, incident: BreachRow): Promise<ContactSettings> {
  if (incident.siteId) {
    const site = await getSiteForOrg(incident.siteId, orgId);
    if (site) return contactFromSettings(site.settings);
  }
  const sites = await listSites(orgId);
  if (sites[0]) {
    const site = await getSiteForOrg(sites[0].id, orgId);
    if (site) return contactFromSettings(site.settings);
  }
  return { ...DEFAULT_CONTACT_SETTINGS };
}

export default async function BreachDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const incident = await getIncident(session.orgId, id);
  if (!incident) notFound();

  const contact = await contactForIncident(session.orgId, incident);
  const boardDraft = boardBreachNotice(incident, contact);
  const principalDraft = principalBreachNotice(incident, contact);
  const notifications = await listNotifications(session.orgId, id);

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <Link href="/dashboard/compliance/breach" className="text-sm text-muted hover:text-ink">
          ← Breach reporting
        </Link>
        <h1 className="mt-1 text-[2rem] leading-tight">Incident</h1>
        <p className="mt-1 text-xs text-muted">
          {incident.domain ? `${incident.domain} · ` : ""}detected {when.format(new Date(incident.detectedAt))}
        </p>
      </div>

      <section className="rounded-2xl border border-hairline p-5 text-sm">
        <dl className="space-y-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">What happened</dt>
            <dd className="mt-1 whitespace-pre-wrap text-ink">{incident.nature}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Data involved</dt>
            <dd className="mt-1 text-body">
              {incident.dataCategories.length > 0 ? incident.dataCategories.join(", ") : "Not specified"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Estimated affected</dt>
            <dd className="mt-1 text-body">{incident.estAffected != null ? incident.estAffected : "Unknown"}</dd>
          </div>
          {incident.remediation && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">Remediation</dt>
              <dd className="mt-1 whitespace-pre-wrap text-body">{incident.remediation}</dd>
            </div>
          )}
        </dl>
      </section>

      <BreachDetail
        id={incident.id}
        status={incident.status}
        estAffected={incident.estAffected}
        boardNotifiedAt={incident.boardNotifiedAt}
        principalsNotifiedAt={incident.principalsNotifiedAt}
        boardDraft={boardDraft}
        principalDraft={principalDraft}
        notifications={notifications}
      />
    </div>
  );
}
