"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/guard";
import { createSite, listSites } from "@/lib/orgs/queries";
import { normalizeDomain } from "@/lib/domain";
import { getOrgGate, blockedReason } from "@/lib/billing/gate";

export type AddSiteState = { error?: string; ok?: boolean };

export async function addSite(
  _prev: AddSiteState,
  formData: FormData,
): Promise<AddSiteState> {
  const session = await requireSession();
  const domain = normalizeDomain(String(formData.get("domain") ?? ""));
  if (!domain) {
    return { error: "That domain doesn't look right. Try something like yourstore.in." };
  }

  if (session.role === "viewer") {
    return { error: "You have view-only access. Ask an owner or admin to make changes." };
  }
  const gate = await getOrgGate(session.orgId);
  const blocked = gate ? blockedReason(gate) : "Organisation not found.";
  if (blocked) return { error: blocked };

  const sites = await listSites(session.orgId);
  if (gate && Number.isFinite(gate.limits.maxSites) && sites.length >= gate.limits.maxSites) {
    return {
      error: `Your plan includes ${gate.limits.maxSites} site${gate.limits.maxSites === 1 ? "" : "s"}. Upgrade to add more.`,
    };
  }

  try {
    await createSite(session.orgId, session.userId, domain);
  } catch (err) {
    console.error("[dashboard] addSite failed", err);
    return { error: "We couldn't add that site. Try again in a minute." };
  }
  revalidatePath("/dashboard");
  return { ok: true };
}
