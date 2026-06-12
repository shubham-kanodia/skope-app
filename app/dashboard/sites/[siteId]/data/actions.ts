"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/guard";
import { sql } from "@/lib/db/client";
import { getSiteForOrg } from "@/lib/orgs/queries";
import { guardWrite } from "@/lib/billing/gate";
import { mergeBannerSettings } from "@/lib/banner/settings";
import { coerceDataItems } from "@/lib/data-items/types";
import { listDataItems, replaceDataItems } from "@/lib/data-items/store";
import type { DataItem } from "@/lib/data-items/types";

export interface SaveDataItemsResult {
  ok?: boolean;
  error?: string;
  /** Non-fatal note (e.g. translation skipped) — the items still saved. */
  warning?: string;
  items?: DataItem[];
}

/** Replace the site's declared data items (DPDP §5 itemized notice). */
export async function saveDataItems(siteId: string, raw: unknown): Promise<SaveDataItemsResult> {
  const session = await requireSession();
  const site = await getSiteForOrg(siteId, session.orgId);
  if (!site) return { error: "Site not found." };

  const blocked = await guardWrite(session);
  if (blocked) return { error: blocked };

  const items = coerceDataItems(raw);
  if (!items) return { error: "Couldn't read the list. Refresh and try again." };

  const languages = mergeBannerSettings((site.settings as { banner?: unknown }).banner).languages;
  try {
    const result = await replaceDataItems(siteId, items, languages);
    await sql`
      insert into audit_log (org_id, actor_user_id, action, target)
      values (${session.orgId}, ${session.userId}, 'data_items.updated', ${siteId})`;
    revalidatePath(`/dashboard/sites/${siteId}`);
    return { ok: true, warning: result.translationWarning, items: await listDataItems(siteId) };
  } catch (err) {
    console.error("[data-items] save failed", err);
    return { error: "Couldn't save. Try again in a minute." };
  }
}
