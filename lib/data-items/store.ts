import { sql } from "@/lib/db/client";
import { translateBatch } from "@/lib/translate/google";
import type { DataItem, DataItemCategory, DataItemInput } from "./types";

/**
 * Declared data items per site. The list is small (≤40), so saving replaces the
 * whole set in one transaction, simplest sync that keeps positions and removals
 * correct. Names are best-effort translated into the site's banner languages on
 * save; failure degrades to English-only (same posture as banner/policy
 * translation).
 */
export async function listDataItems(siteId: string): Promise<DataItem[]> {
  const rows = await sql`
    select id, key, name_i18n, category, purpose_key, source_label, retention_days, position
    from data_items
    where site_id = ${siteId}
    order by position asc, created_at asc`;
  return rows.map((r) => ({
    id: r.id as string,
    key: r.key as string,
    name: (r.name_i18n ?? {}) as Record<string, string>,
    category: r.category as DataItemCategory,
    purposeKey: r.purpose_key as string,
    sourceLabel: (r.source_label as string | null) ?? null,
    retentionDays: (r.retention_days as number | null) ?? null,
    position: r.position as number,
  }));
}

export async function countDataItems(siteId: string): Promise<number> {
  const rows = await sql`select count(*)::int as n from data_items where site_id = ${siteId}`;
  return (rows[0]?.n as number) ?? 0;
}

export interface SaveResult {
  count: number;
  /** Set when translation was skipped or failed; English names are still saved. */
  translationWarning?: string;
}

/** Replace the site's declared items. `languages` come from the banner settings. */
export async function replaceDataItems(
  siteId: string,
  items: DataItemInput[],
  languages: string[],
): Promise<SaveResult> {
  const targets = [...new Set(languages)].filter((l) => l && l !== "en").slice(0, 22);
  let warning: string | undefined;

  // Acronyms like PAN or UPI mistranslate badly ("PAN" → "frying pan" in
  // Hindi), so they keep their English form in every language.
  const isAcronym = (name: string) => /^[A-Z0-9]{2,6}$/.test(name);
  const names: Record<string, string>[] = items.map((i) => ({ en: i.name }));
  const toTranslate = items.map((i, idx) => ({ idx, name: i.name })).filter((x) => !isAcronym(x.name));
  if (toTranslate.length > 0 && targets.length > 0) {
    try {
      for (const lang of targets) {
        const translated = await translateBatch(toTranslate.map((x) => x.name), lang, "en");
        translated.forEach((t, j) => {
          names[toTranslate[j].idx][lang] = t;
        });
      }
    } catch (err) {
      warning =
        err instanceof Error && err.message.includes("isn't configured")
          ? "Auto-translate isn't configured, so names were saved in English only."
          : "Couldn't translate names right now, so they were saved in English only.";
    }
  }

  await sql.begin(async (tx) => {
    await tx`delete from data_items where site_id = ${siteId}`;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      await tx`
        insert into data_items (site_id, key, name_i18n, category, purpose_key, source_label, retention_days, position)
        values (${siteId}, ${item.key}, ${tx.json(names[i])}, ${item.category}, ${item.purposeKey},
                ${item.sourceLabel}, ${item.retentionDays}, ${i})`;
    }
  });

  return { count: items.length, ...(warning ? { translationWarning: warning } : {}) };
}
