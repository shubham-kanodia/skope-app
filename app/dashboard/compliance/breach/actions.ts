"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/guard";
import { getSiteForOrg, listSites } from "@/lib/orgs/queries";
import { contactFromSettings, DEFAULT_CONTACT_SETTINGS, type ContactSettings } from "@/lib/contact/settings";
import {
  createIncident,
  getIncident,
  updateIncidentStatus,
  recordNotification,
} from "@/lib/breach/store";
import { coerceBreachInput, BREACH_STATUSES, type BreachStatus, type BreachRow } from "@/lib/breach/types";
import { boardBreachNotice, principalBreachNotice } from "@/lib/breach/notice-template";

export interface BreachActionResult {
  ok?: boolean;
  error?: string;
  id?: string;
}

/** Resolve the contact details used in a breach notice: the incident's site, or a fallback. */
async function contactForIncident(orgId: string, incident: BreachRow): Promise<ContactSettings> {
  if (incident.siteId) {
    const site = await getSiteForOrg(incident.siteId, orgId);
    if (site) return contactFromSettings(site.settings);
  }
  // Org-wide incident: borrow the most recent site's contact so the notice isn't empty.
  const sites = await listSites(orgId);
  if (sites[0]) {
    const site = await getSiteForOrg(sites[0].id, orgId);
    if (site) return contactFromSettings(site.settings);
  }
  return { ...DEFAULT_CONTACT_SETTINGS };
}

/** Record a new breach incident. */
export async function recordBreach(raw: unknown, siteId: string | null): Promise<BreachActionResult> {
  const session = await requireSession();
  const input = coerceBreachInput(raw);
  if (!input) return { error: "Add what happened and when you detected it." };

  // Validate the site belongs to the org, if one was chosen.
  let scopedSite: string | null = null;
  if (siteId) {
    const site = await getSiteForOrg(siteId, session.orgId);
    if (!site) return { error: "Site not found." };
    scopedSite = siteId;
  }

  try {
    const id = await createIncident(session.orgId, session.userId, scopedSite, input);
    revalidatePath("/dashboard/compliance/breach");
    return { ok: true, id };
  } catch (err) {
    console.error("[breach] record failed", err);
    return { error: "Couldn't save the incident. Try again in a minute." };
  }
}

/** Update an incident's status. */
export async function setBreachStatus(id: string, status: BreachStatus): Promise<BreachActionResult> {
  const session = await requireSession();
  if (!BREACH_STATUSES.includes(status)) return { error: "Invalid status." };
  const ok = await updateIncidentStatus(session.orgId, session.userId, id, status);
  if (!ok) return { error: "Incident not found." };
  revalidatePath(`/dashboard/compliance/breach/${id}`);
  revalidatePath("/dashboard/compliance/breach");
  return { ok: true };
}

/**
 * Mark that the Board or affected principals were notified. Re-derives the
 * deterministic notice draft from the incident + contact and snapshots it, so
 * the record shows exactly what was sent.
 */
export async function markBreachNotified(
  id: string,
  audience: "board" | "principals",
  recipientCount: number | null,
): Promise<BreachActionResult> {
  const session = await requireSession();
  const incident = await getIncident(session.orgId, id);
  if (!incident) return { error: "Incident not found." };

  const contact = await contactForIncident(session.orgId, incident);
  const draft = audience === "board" ? boardBreachNotice(incident, contact) : principalBreachNotice(incident, contact);

  const ok = await recordNotification(session.orgId, session.userId, id, {
    audience,
    channel: audience === "board" ? "board_portal" : "email",
    recipientCount: audience === "principals" ? recipientCount ?? incident.estAffected : null,
    subject: draft.subject,
    body: draft.body,
  });
  if (!ok) return { error: "Incident not found." };

  revalidatePath(`/dashboard/compliance/breach/${id}`);
  revalidatePath("/dashboard/compliance/breach");
  return { ok: true };
}
