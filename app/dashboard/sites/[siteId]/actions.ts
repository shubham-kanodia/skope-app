"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/guard";
import { sql } from "@/lib/db/client";
import { getSiteForOrg } from "@/lib/orgs/queries";
import { mergeBannerSettings, type BannerSettings, type BannerCopy } from "@/lib/banner/settings";
import { ensureTranslations } from "@/lib/banner/translate";
import { mergeContactSettings, hasGrievanceContact, type ContactSettings } from "@/lib/contact/settings";
import { getOrgGate, blockedReason, guardWrite } from "@/lib/billing/gate";

export interface SaveBannerResult {
  ok?: boolean;
  error?: string;
  /** Non-fatal note (e.g. translation skipped) — the banner still saved. */
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
    const { translations, translationsHash, translated, charsTranslated } =
      await ensureTranslations(banner);
    banner = { ...banner, translations, translationsHash };
    costs = { translateChars: charsTranslated, translatedLanguages: translated.length };
  } catch (err) {
    console.error("[banner] auto-translate skipped", err);
    warning = "Saved, but auto-translate is unavailable right now. Other languages will fall back to your default text.";
  }

  const settings = JSON.parse(JSON.stringify({ ...site.settings, banner }));
  try {
    await sql`update sites set settings = ${sql.json(settings)} where id = ${siteId} and org_id = ${session.orgId}`;
    await sql`
      insert into audit_log (org_id, actor_user_id, action, target)
      values (${session.orgId}, ${session.userId}, 'banner.updated', ${siteId})`;
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
    await sql`
      insert into audit_log (org_id, actor_user_id, action, target)
      values (${session.orgId}, ${session.userId}, 'contact.updated', ${siteId})`;
  } catch (err) {
    console.error("[contact] save failed", err);
    return { error: "Couldn't save. Try again in a minute." };
  }

  revalidatePath(`/dashboard/sites/${siteId}/contact`);
  return { ok: true, contact };
}

export interface PreviewTranslateResult {
  translations?: Record<string, BannerCopy>;
  translationsHash?: string;
  error?: string;
  /** Google Translate usage this call, so the client can report it to analytics. */
  costs?: { translateChars: number; translatedLanguages: number };
}

/**
 * Translate the current (possibly unsaved) banner copy into every selected
 * language for the live preview. Does NOT persist — Save writes the final copy
 * + translations atomically. Cached by source hash, so this is cheap to call.
 */
export async function previewTranslate(siteId: string, raw: unknown): Promise<PreviewTranslateResult> {
  const session = await requireSession();
  const site = await getSiteForOrg(siteId, session.orgId);
  if (!site) return { error: "Site not found." };

  const banner = mergeBannerSettings(raw);
  try {
    const { translations, translationsHash, translated, charsTranslated } =
      await ensureTranslations(banner);
    return {
      translations,
      translationsHash,
      costs: { translateChars: charsTranslated, translatedLanguages: translated.length },
    };
  } catch (err) {
    console.error("[banner] preview translate failed", err);
    return { error: "Auto-translate is unavailable right now." };
  }
}
