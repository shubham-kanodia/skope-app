import { DEFAULT_PURPOSES } from "@/lib/banner/settings";

/**
 * Personal data items a site declares it collects (DPDP §5 itemized notice).
 * Pure types + coercion so untrusted editor payloads are clamped at the action
 * boundary, mirroring mergeBannerSettings / coercePolicyContent.
 */
export const DATA_ITEM_CATEGORIES = [
  "identity",
  "contact",
  "financial",
  "official_id",
  "usage",
  "other",
] as const;

export type DataItemCategory = (typeof DATA_ITEM_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<DataItemCategory, string> = {
  identity: "Identity",
  contact: "Contact",
  financial: "Financial",
  official_id: "Official ID",
  usage: "Usage",
  other: "Other",
};

/** A stored item, as read from the DB. */
export interface DataItem {
  id: string;
  key: string;
  name: Record<string, string>; // i18n, 'en' always present
  category: DataItemCategory;
  purposeKey: string;
  sourceLabel: string | null;
  retentionDays: number | null;
  position: number;
}

/** An item as submitted by the editor (no id yet; English name only). */
export interface DataItemInput {
  key: string;
  name: string; // English source; translations added on save
  category: DataItemCategory;
  purposeKey: string;
  sourceLabel: string | null;
  retentionDays: number | null;
}

const MAX_ITEMS = 40;
const PURPOSE_KEYS = new Set(DEFAULT_PURPOSES.map((p) => p.key));

/** Slug for the unique (site_id, key): lowercase, dashes, bounded. */
export function slugifyKey(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "item"
  );
}

/**
 * Clamp an untrusted editor payload into a valid item list, or null when the
 * shape is unusable. Dedupes keys (first wins), caps the list, whitelists
 * categories and purpose keys.
 */
export function coerceDataItems(raw: unknown): DataItemInput[] | null {
  if (!Array.isArray(raw)) return null;
  const out: DataItemInput[] = [];
  const seen = new Set<string>();

  for (const v of raw.slice(0, MAX_ITEMS * 2)) {
    if (!v || typeof v !== "object") continue;
    const r = v as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name.trim().slice(0, 80) : "";
    if (!name) continue;

    let key = typeof r.key === "string" && r.key.trim() ? slugifyKey(r.key) : slugifyKey(name);
    if (seen.has(key)) {
      let n = 2;
      while (seen.has(`${key}-${n}`)) n++;
      key = `${key}-${n}`.slice(0, 52);
    }
    seen.add(key);

    const category = DATA_ITEM_CATEGORIES.includes(r.category as DataItemCategory)
      ? (r.category as DataItemCategory)
      : "other";
    const purposeKey =
      typeof r.purposeKey === "string" && PURPOSE_KEYS.has(r.purposeKey) ? r.purposeKey : "necessary";
    const sourceLabel =
      typeof r.sourceLabel === "string" && r.sourceLabel.trim() ? r.sourceLabel.trim().slice(0, 80) : null;
    const retention = Number(r.retentionDays);
    const retentionDays =
      Number.isInteger(retention) && retention > 0 && retention <= 36500 ? retention : null;

    out.push({ key, name, category, purposeKey, sourceLabel, retentionDays });
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}
