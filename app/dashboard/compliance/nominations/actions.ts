"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/guard";
import { getSiteForOrg } from "@/lib/orgs/queries";
import {
  createNomination,
  setNominationStatus,
  type NominationStatus,
} from "@/lib/nominations/store";
import type { NominationRow } from "@/lib/nominations/types";

export interface NominationActionResult {
  ok?: boolean;
  error?: string;
  /** The created row, so the client list can append it without a full reload. */
  row?: NominationRow;
}

export async function recordNomination(input: {
  siteId: string;
  principalRef: string;
  nomineeName: string;
  nomineeContact: string;
  relationship: string;
}): Promise<NominationActionResult> {
  const session = await requireSession();
  if (!input.nomineeName.trim()) return { error: "Add the nominee's name." };
  const site = await getSiteForOrg(input.siteId, session.orgId);
  if (!site) return { error: "Pick one of your sites." };

  const id = await createNomination(session.orgId, session.userId, {
    siteId: input.siteId,
    principalRef: input.principalRef.trim() || null,
    nomineeName: input.nomineeName.trim(),
    nomineeContact: input.nomineeContact.trim() || null,
    relationship: input.relationship.trim() || null,
  });
  revalidatePath("/dashboard/compliance/nominations");
  return {
    ok: true,
    row: {
      id,
      siteId: input.siteId,
      domain: site.domain,
      principalRef: input.principalRef.trim() || null,
      nomineeName: input.nomineeName.trim(),
      nomineeContact: input.nomineeContact.trim() || null,
      relationship: input.relationship.trim() || null,
      status: "recorded",
      activatedAt: null,
      createdAt: new Date().toISOString(),
    },
  };
}

const STATUSES = new Set<NominationStatus>(["recorded", "activated", "revoked"]);

export async function updateNomination(id: string, status: NominationStatus): Promise<NominationActionResult> {
  const session = await requireSession();
  if (!STATUSES.has(status)) return { error: "Invalid status." };
  const ok = await setNominationStatus(session.orgId, session.userId, id, status);
  if (!ok) return { error: "Nomination not found." };
  revalidatePath("/dashboard/compliance/nominations");
  return { ok: true };
}
