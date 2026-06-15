"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/guard";
import { sql } from "@/lib/db/client";
import { getSiteForOrg } from "@/lib/orgs/queries";
import { mergeBannerSettings, type BannerSettings, type BannerCopy } from "@/lib/banner/settings";
import { ensureTranslations } from "@/lib/banner/translate";
import { LANGUAGES } from "@/lib/banner/languages";
import { mergeContactSettings, hasGrievanceContact, type ContactSettings } from "@/lib/contact/settings";
import { getOrgGate, blockedReason, guardWrite } from "@/lib/billing/gate";
import { writeAudit } from "@/lib/audit/write";
import { mergeRetentionSettings, type RetentionSettings } from "@/lib/retention/settings";
import { mergeChildrenSettings, type ChildrenSettings } from "@/lib/children/settings";
import { mergeExemptionSettings, type ExemptionSettings } from "@/lib/exemptions/settings";

export interface SaveBannerResult {
  ok?: boolean;
  error?: string;
  /** Non-fatal note (e.g. translation skipped), the banner still saved. */
  warning?: string;
  /** The persisted banner, including any newly-cached translations. */
  banner?: BannerSettings;
  /** Google Translate usage this call, so the client can report it to analytics. */
  costs?: { translateChars: number; translatedLanguages: number };
}

export async function saveBannerSettings(
  siteId: string,
  raw: unknown,
): Promise<SaveBannerResult> {
  const session = await requireSession();
  const site = await getSiteForOrg(siteId, session.orgId);
  if (!site) return { error: "Site not found." };

  if (session.role === "viewer") {
    return { error: "You have view-only access. Ask an owner or admin to make changes." };
  }
  const gate = await getOrgGate(session.orgId);
  const blocked = gate ? blockedReason(gate) : "Organisation not found.";
  if (blocked) return { error: blocked };

  let banner = mergeBannerSettings(raw);

  // Clamp languages on tiers without all-language support (free = en + hi only).
  if (gate && !gate.limits.allLanguages) {
    const langs = banner.languages.filter((l) => l === "en" || l === "hi");
    banner = { ...banner, languages: langs.length ? langs : ["en"] };
  }

  // Auto-translate the selected languages, translating only what's new or stale.
  let warning: string | undefined;
  let costs: SaveBannerResult["costs"];
  try {
    const { translations, translationsHash, translated, failed, charsTranslated } =
      await ensureTranslations(banner);
    banner = { ...banner, translations, translationsHash };
    costs = { translateChars: charsTranslated, translatedLanguages: translated.length };
    warning = translateWarning(failed);
  } catch (err) {
    console.error("[banner] auto-translate skipped", err);
    warning = "Saved, but auto-translate is unavailable right now. Other languages will fall back to your default text.";
  }

  const settings = JSON.parse(JSON.stringify({ ...site.settings, banner }));
  try {
    await sql`update sites set settings = ${sql.json(settings)} where id = ${siteId} and org_id = ${session.orgId}`;
    await writeAudit({ orgId: session.orgId, actorUserId: session.userId, action: "banner.updated", target: siteId });
  } catch (err) {
    console.error("[banner] save failed", err);
    return { error: "Couldn't save. Try again in a minute." };
  }

  revalidatePath(`/dashboard/sites/${siteId}`);
  return { ok: true, warning, banner, costs };
}

export interface SaveContactResult {
  ok?: boolean;
  error?: string;
  contact?: ContactSettings;
}

/** Persist the grievance officer + DPO contact into sites.settings.contact. */
export async function saveContactSettings(
  siteId: string,
  raw: unknown,
): Promise<SaveContactResult> {
  const session = await requireSession();
  const site = await getSiteForOrg(siteId, session.orgId);
  if (!site) return { error: "Site not found." };

  const blocked = await guardWrite(session);
  if (blocked) return { error: blocked };

  const contact = mergeContactSettings(raw);
  if (!hasGrievanceContact(contact)) {
    return { error: "Add a grievance officer name and a valid email. DPDP requires a working grievance contact." };
  }

  const settings = JSON.parse(JSON.stringify({ ...site.settings, contact }));
  try {
    await sql`update sites set settings = ${sql.json(settings)} where id = ${siteId} and org_id = ${session.orgId}`;
    await writeAudit({ orgId: session.orgId, actorUserId: session.userId, action: "contact.updated", target: siteId });
  } catch (err) {
    console.error("[contact] save failed", err);
    return { error: "Couldn't save. Try again in a minute." };
  }

  revalidatePath(`/dashboard/sites/${siteId}/contact`);
  return { ok: true, contact };
}

export interface SaveRetentionResult {
  ok?: boolean;
  error?: string;
  retention?: RetentionSettings;
}

/**
 * Persist the §8(8) inactivity window into sites.settings.retention. The
 * retention sweep reads this to decide when a purpose is "no longer served".
 */
export async function saveRetentionSettings(siteId: string, raw: unknown): Promise<SaveRetentionResult> {
  const session = await requireSession();
  const site = await getSiteForOrg(siteId, session.orgId);
  if (!site) return { error: "Site not found." };

  const blocked = await guardWrite(session);
  if (blocked) return { error: blocked };

  const retention = mergeRetentionSettings(raw);
  const settings = JSON.parse(JSON.stringify({ ...site.settings, retention }));
  try {
    await sql`update sites set settings = ${sql.json(settings)} where id = ${siteId} and org_id = ${session.orgId}`;
    await writeAudit({ orgId: session.orgId, actorUserId: session.userId, action: "retention.updated", target: siteId });
  } catch (err) {
    console.error("[retention] save failed", err);
    return { error: "Couldn't save. Try again in a minute." };
  }

  revalidatePath(`/dashboard/sites/${siteId}`);
  return { ok: true, retention };
}

export interface SaveChildrenResult {
  ok?: boolean;
  error?: string;
  children?: ChildrenSettings;
}

/**
 * Persist children's-data settings (DPDP §9) into sites.settings.children.
 * Drives the banner age gate + child mode and the notice's children section.
 */
export async function saveChildrenSettings(siteId: string, raw: unknown): Promise<SaveChildrenResult> {
  const session = await requireSession();
  const site = await getSiteForOrg(siteId, session.orgId);
  if (!site) return { error: "Site not found." };

  const blocked = await guardWrite(session);
  if (blocked) return { error: blocked };

  const children = mergeChildrenSettings(raw);
  const settings = JSON.parse(JSON.stringify({ ...site.settings, children }));
  try {
    await sql`update sites set settings = ${sql.json(settings)} where id = ${siteId} and org_id = ${session.orgId}`;
    await writeAudit({ orgId: session.orgId, actorUserId: session.userId, action: "children.updated", target: siteId });
  } catch (err) {
    console.error("[children] save failed", err);
    return { error: "Couldn't save. Try again in a minute." };
  }

  revalidatePath(`/dashboard/sites/${siteId}`);
  return { ok: true, children };
}

export interface SaveExemptionsResult {
  ok?: boolean;
  error?: string;
  exemptions?: ExemptionSettings;
}

/** Persist recorded §17 / §9(4) exemption grounds into sites.settings.exemptions. */
export async function saveExemptionSettings(siteId: string, raw: unknown): Promise<SaveExemptionsResult> {
  const session = await requireSession();
  const site = await getSiteForOrg(siteId, session.orgId);
  if (!site) return { error: "Site not found." };

  const blocked = await guardWrite(session);
  if (blocked) return { error: blocked };

  const exemptions = mergeExemptionSettings(raw);
  const settings = JSON.parse(JSON.stringify({ ...site.settings, exemptions }));
  try {
    await sql`update sites set settings = ${sql.json(settings)} where id = ${siteId} and org_id = ${session.orgId}`;
    await writeAudit({ orgId: session.orgId, actorUserId: session.userId, action: "exemptions.updated", target: siteId });
  } catch (err) {
    console.error("[exemptions] save failed", err);
    return { error: "Couldn't save. Try again in a minute." };
  }

  revalidatePath(`/dashboard/sites/${siteId}`);
  return { ok: true, exemptions };
}

export interface PreviewTranslateResult {
  translations?: Record<string, BannerCopy>;
  translationsHash?: string;
  error?: string;
  /** Non-fatal note when some languages couldn't be translated. */
  warning?: string;
  /** Google Translate usage this call, so the client can report it to analytics. */
  costs?: { translateChars: number; translatedLanguages: number };
}

/** A human note naming the languages that couldn't be auto-translated, or undefined. */
function translateWarning(failed: string[]): string | undefined {
  if (failed.length === 0) return undefined;
  const names = failed.map((c) => LANGUAGES.find((l) => l.code === c)?.english ?? c);
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
  return `Saved, but we couldn't auto-translate ${list} right now. ${
    failed.length > 1 ? "Those languages" : "That language"
  } will show your default text until the next save. You can also edit the copy by hand in the preview.`;
}

/**
 * Translate the current (possibly unsaved) banner copy into every selected
 * language for the live preview. Does NOT persist, Save writes the final copy
 * + translations atomically. Cached by source hash, so this is cheap to call.
 */
export async function previewTranslate(siteId: string, raw: unknown): Promise<PreviewTranslateResult> {
  const session = await requireSession();
  const site = await getSiteForOrg(siteId, session.orgId);
  if (!site) return { error: "Site not found." };

  const banner = mergeBannerSettings(raw);
  try {
    const { translations, translationsHash, translated, failed, charsTranslated } =
      await ensureTranslations(banner);
    return {
      translations,
      translationsHash,
      warning: translateWarning(failed),
      costs: { translateChars: charsTranslated, translatedLanguages: translated.length },
    };
  } catch (err) {
    console.error("[banner] preview translate failed", err);
    return { error: "Auto-translate is unavailable right now." };
  }
}
