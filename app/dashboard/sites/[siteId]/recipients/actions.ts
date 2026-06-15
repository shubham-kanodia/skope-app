"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/guard";
import { getSiteForOrg } from "@/lib/orgs/queries";
import { guardWrite } from "@/lib/billing/gate";
import { writeAudit } from "@/lib/audit/write";
import { coerceRecipients } from "@/lib/recipients/types";
import { listRecipients, replaceRecipients } from "@/lib/recipients/store";
import type { Recipient } from "@/lib/recipients/types";

export interface SaveRecipientsResult {
  ok?: boolean;
  error?: string;
  recipients?: Recipient[];
}

/** Replace a site's recipients register (DPDP §5/§8(2)/§11(1)(b)). */
export async function saveRecipients(siteId: string, raw: unknown): Promise<SaveRecipientsResult> {
  const session = await requireSession();
  const site = await getSiteForOrg(siteId, session.orgId);
  if (!site) return { error: "Site not found." };

  const blocked = await guardWrite(session);
  if (blocked) return { error: blocked };

  const recipients = coerceRecipients(raw);
  if (!recipients) return { error: "Couldn't read the list. Refresh and try again." };

  try {
    await replaceRecipients(siteId, recipients);
    await writeAudit({ orgId: session.orgId, actorUserId: session.userId, action: "recipient.update", target: siteId });
  } catch (err) {
    console.error("[recipients] save failed", err);
    return { error: "Couldn't save. Try again in a minute." };
  }

  revalidatePath(`/dashboard/sites/${siteId}`);
  revalidatePath("/dashboard/compliance/recipients");
  return { ok: true, recipients: await listRecipients(siteId) };
}
