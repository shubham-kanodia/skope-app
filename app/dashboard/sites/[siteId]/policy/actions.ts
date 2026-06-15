"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/guard";
import { sql } from "@/lib/db/client";
import { getOrg, getSiteForOrg } from "@/lib/orgs/queries";
import { mergeBannerSettings, DEFAULT_PURPOSES } from "@/lib/banner/settings";
import { contactFromSettings } from "@/lib/contact/settings";
import { childrenFromSettings } from "@/lib/children/settings";
import { listRecipients } from "@/lib/recipients/store";
import { listDataItems } from "@/lib/data-items/store";
import { CATEGORY_LABELS } from "@/lib/data-items/types";
import { generatePolicyDraft } from "@/lib/policy/generate";
import { analyzeSite } from "@/lib/scan/analyze";
import { coercePolicyContent, type PolicyInput } from "@/lib/policy/types";
import { saveDraft, publishLatestDraft, buildContentI18nTracked, type NoticeRow } from "@/lib/notices/store";
import { guardWrite } from "@/lib/billing/gate";
import { writeAudit } from "@/lib/audit/write";

export interface PolicyActionResult {
  ok?: boolean;
  error?: string;
  notice?: NoticeRow;
  /** Where the draft text came from, surfaced to the user. */
  source?: "ai" | "template";
  /** Google Translate usage this call, so the client can report it to analytics. */
  costs?: { translateChars: number; translatedLanguages: number };
}

async function loadInput(siteId: string, orgId: string): Promise<{ input: PolicyInput; languages: string[] } | null> {
  const site = await getSiteForOrg(siteId, orgId);
  if (!site) return null;
  const org = await getOrg(orgId);
  const banner = mergeBannerSettings((site.settings as { banner?: unknown }).banner);
  const contact = contactFromSettings(site.settings);
  const children = childrenFromSettings(site.settings);

  // Trackers: live-scan the homepage so the notice lists what's actually loaded,
  // merged with anything already recorded in the trackers table. The scan is
  // best-effort (private/unreachable hosts just yield none).
  const trackerByName = new Map<string, { name: string; category: string }>();
  const trackerRows = await sql`
    select detected_name, category from trackers where site_id = ${siteId} order by detected_name`;
  for (const r of trackerRows) {
    trackerByName.set(String(r.detected_name), {
      name: String(r.detected_name),
      category: (r.category as string | null) ?? "analytics",
    });
  }
  try {
    const report = await analyzeSite(site.domain);
    for (const t of report.trackers) trackerByName.set(t.name, { name: t.name, category: t.category });
  } catch (err) {
    console.error("[policy] tracker scan skipped", err);
  }
  const trackers = [...trackerByName.values()];

  // Declared data items (DPDP §5): the notice must itemize what's collected.
  const purposeNames = new Map(DEFAULT_PURPOSES.map((p) => [p.key, p.name.en ?? p.key]));
  const dataItems = (await listDataItems(siteId)).map((d) => ({
    name: d.name.en ?? d.key,
    category: CATEGORY_LABELS[d.category],
    purpose: purposeNames.get(d.purposeKey) ?? d.purposeKey,
    source: d.sourceLabel,
    retentionDays: d.retentionDays,
  }));

  // Prefer the legal name set on the Contact tab; fall back to a non-default org
  // name, then the domain. Never use the "My workspace" signup placeholder.
  const orgName =
    contact.entityName.trim() ||
    (org && org.name !== "My workspace" ? org.name : "") ||
    site.domain;

  const input: PolicyInput = {
    orgName,
    domain: site.domain,
    purposes: DEFAULT_PURPOSES.map((p) => ({
      key: p.key,
      isEssential: p.isEssential,
      name: p.name.en ?? p.key,
      description: p.description.en ?? "",
      retentionDays: null,
    })),
    trackers,
    dataItems,
    grievanceName: contact.grievanceName,
    grievanceEmail: contact.grievanceEmail,
    grievancePhone: contact.grievancePhone,
    grievanceAddress: contact.grievanceAddress,
    dpoName: contact.dpoName,
    dpoEmail: contact.dpoEmail,
    responseDays: contact.responseDays,
    children: {
      directedAtChildren: children.directedAtChildren,
      childMode: children.childMode,
      exemptClass: children.exemptClass,
    },
    recipients: (await listRecipients(siteId)).map((r) => ({
      name: r.name,
      role: r.role,
      purpose: r.purpose,
      country: r.country,
    })),
  };
  return { input, languages: banner.languages };
}

/** Generate a fresh draft from the site's data and save it as a draft version. */
export async function generatePolicy(siteId: string): Promise<PolicyActionResult> {
  const session = await requireSession();
  const loaded = await loadInput(siteId, session.orgId);
  if (!loaded) return { error: "Site not found." };

  const blocked = await guardWrite(session);
  if (blocked) return { error: blocked };

  try {
    const { content, source } = await generatePolicyDraft(loaded.input);
    const { contentI18n, translateChars, translatedLanguages } =
      await buildContentI18nTracked(content, loaded.languages);
    const notice = await saveDraft(siteId, contentI18n);
    await writeAudit({ orgId: session.orgId, actorUserId: session.userId, action: "policy.generated", target: siteId });
    revalidatePath(`/dashboard/sites/${siteId}/policy`);
    return { ok: true, notice, source, costs: { translateChars, translatedLanguages } };
  } catch (err) {
    console.error("[policy] generate action failed", err);
    return { error: "Couldn't generate the notice. Try again in a minute." };
  }
}

/** Save edited English sections of the current draft (re-translates other languages). */
export async function savePolicyDraft(siteId: string, rawEnglish: unknown): Promise<PolicyActionResult> {
  const session = await requireSession();
  const loaded = await loadInput(siteId, session.orgId);
  if (!loaded) return { error: "Site not found." };

  const blocked = await guardWrite(session);
  if (blocked) return { error: blocked };

  const english = coercePolicyContent(rawEnglish);
  if (!english) return { error: "The notice needs a title and at least one section." };

  try {
    const { contentI18n, translateChars, translatedLanguages } =
      await buildContentI18nTracked(english, loaded.languages);
    const notice = await saveDraft(siteId, contentI18n);
    revalidatePath(`/dashboard/sites/${siteId}/policy`);
    return { ok: true, notice, costs: { translateChars, translatedLanguages } };
  } catch (err) {
    console.error("[policy] save draft failed", err);
    return { error: "Couldn't save. Try again in a minute." };
  }
}

/** Publish the current draft. The public privacy page then serves it. */
export async function publishPolicy(siteId: string): Promise<PolicyActionResult> {
  const session = await requireSession();
  const site = await getSiteForOrg(siteId, session.orgId);
  if (!site) return { error: "Site not found." };

  const blocked = await guardWrite(session);
  if (blocked) return { error: blocked };

  try {
    const notice = await publishLatestDraft(siteId);
    if (!notice) return { error: "There's no draft to publish. Generate one first." };
    await writeAudit({ orgId: session.orgId, actorUserId: session.userId, action: "policy.published", target: siteId });
    revalidatePath(`/dashboard/sites/${siteId}/policy`);
    return { ok: true, notice };
  } catch (err) {
    console.error("[policy] publish failed", err);
    return { error: "Couldn't publish. Try again in a minute." };
  }
}
