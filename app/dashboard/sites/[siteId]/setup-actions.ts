"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/guard";
import { sql } from "@/lib/db/client";
import { getSiteForOrg } from "@/lib/orgs/queries";
import { setupFlags, type SetupStepKey } from "@/lib/sites/setup";
import { guardWrite } from "@/lib/billing/gate";

const STEPS = new Set<SetupStepKey>(["install", "banner", "data", "contact", "policy"]);

export interface MarkStepResult {
  ok?: boolean;
  error?: string;
}

/**
 * Mark an onboarding step complete for a site. Persists into
 * sites.settings.setup and stamps completedAt once all four are done. Uses the
 * read-merge-write jsonb pattern (same as saveBannerSettings).
 */
export async function markStepComplete(siteId: string, step: SetupStepKey): Promise<MarkStepResult> {
  const session = await requireSession();
  if (!STEPS.has(step)) return { error: "Unknown step." };

  const site = await getSiteForOrg(siteId, session.orgId);
  if (!site) return { error: "Site not found." };

  const blocked = await guardWrite(session);
  if (blocked) return { error: blocked };

  const flags = { ...setupFlags(site.settings), [step]: true };
  const allDone = flags.install && flags.banner && flags.data && flags.contact && flags.policy;
  if (allDone && !flags.completedAt) flags.completedAt = new Date().toISOString();

  const settings = JSON.parse(JSON.stringify({ ...site.settings, setup: flags }));
  try {
    await sql`update sites set settings = ${sql.json(settings)} where id = ${siteId} and org_id = ${session.orgId}`;
  } catch (err) {
    console.error("[setup] markStepComplete failed", err);
    return { error: "Couldn't save your progress. Try again." };
  }

  revalidatePath(`/dashboard/sites/${siteId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}
