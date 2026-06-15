"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/guard";
import { resolveObligation, type ErasureStatus } from "@/lib/erasure/store";
import { setCessationStatus, signalCessation, type CessationStatus } from "@/lib/cessation/store";

const RESOLVABLE = new Set<ErasureStatus>(["in_progress", "done", "not_required"]);

export interface ErasureActionResult {
  ok?: boolean;
  error?: string;
}

/** Move an erasure obligation through its workflow (org-scoped). */
export async function resolveErasure(
  id: string,
  status: ErasureStatus,
  note: string,
): Promise<ErasureActionResult> {
  const session = await requireSession();
  if (!RESOLVABLE.has(status)) return { error: "Invalid status." };

  const ok = await resolveObligation(
    session.orgId,
    session.userId,
    id,
    status as "in_progress" | "done" | "not_required",
    note.trim() || null,
  );
  if (!ok) return { error: "Obligation not found." };

  revalidatePath("/dashboard/compliance/erasure");
  return { ok: true };
}

const CESSATION_STATUSES = new Set<CessationStatus>(["pending", "signalled", "acknowledged", "manual_done"]);

/** Signal an integrated processor to cease via its webhook (DPDP §6(6)). */
export async function signalCessationTask(taskId: string): Promise<ErasureActionResult> {
  const session = await requireSession();
  const res = await signalCessation(session.orgId, session.userId, taskId);
  if (!res.ok) return { error: res.error ?? "Couldn't signal." };
  revalidatePath("/dashboard/compliance/erasure");
  return { ok: true };
}

/** Manually update a cessation task (acknowledged / done) for non-integrated vendors. */
export async function setCessationTaskStatus(
  taskId: string,
  status: CessationStatus,
  note: string,
): Promise<ErasureActionResult> {
  const session = await requireSession();
  if (!CESSATION_STATUSES.has(status)) return { error: "Invalid status." };
  const ok = await setCessationStatus(session.orgId, session.userId, taskId, status, note.trim() || null);
  if (!ok) return { error: "Task not found." };
  revalidatePath("/dashboard/compliance/erasure");
  return { ok: true };
}
