"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/guard";
import { guardWrite } from "@/lib/billing/gate";
import { createBatch, parseEmailList, siteExists } from "@/lib/retro/store";

export interface RetroActionResult {
  ok?: boolean;
  error?: string;
  queued?: number;
}

/** Queue a §5(2) retrospective-notice broadcast to a pasted contact list. */
export async function queueRetroNotice(siteId: string, rawList: string): Promise<RetroActionResult> {
  const session = await requireSession();
  const blocked = await guardWrite(session);
  if (blocked) return { error: blocked };

  if (!(await siteExists(session.orgId, siteId))) return { error: "Pick one of your sites." };

  const emails = parseEmailList(rawList);
  if (emails.length === 0) return { error: "No valid email addresses found in that list." };

  try {
    const { queued } = await createBatch(session.orgId, session.userId, siteId, emails);
    revalidatePath("/dashboard/compliance/retrospective");
    return { ok: true, queued };
  } catch (err) {
    console.error("[retro] queue failed", err);
    return { error: "Couldn't queue the notice. Try again in a minute." };
  }
}
