"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/guard";
import { sql } from "@/lib/db/client";
import { PAID_PLANS } from "@/lib/plans";
import type { OrgPlan } from "@/lib/entitlement";

/**
 * Grant a plan directly, owner-only. Stand-in for the Razorpay webhook until live
 * keys exist (lets us simulate an upgrade for testing). Sets a 30-day active
 * window; the real webhook does the same on payment.
 */
export async function grantPlan(plan: OrgPlan): Promise<{ ok?: true; error?: string }> {
  const session = await requireSession();
  if (session.role !== "owner") return { error: "Only the owner can change the plan." };
  if (plan !== "free" && !PAID_PLANS.includes(plan)) return { error: "Unknown plan." };

  const activeUntil = plan === "free" ? null : new Date(Date.now() + 30 * 86_400_000);
  await sql`update orgs set plan = ${plan}, plan_active_until = ${activeUntil} where id = ${session.orgId}`;
  revalidatePath("/dashboard/billing");
  revalidatePath("/dashboard");
  return { ok: true };
}
