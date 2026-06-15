"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/guard";
import { guardWrite } from "@/lib/billing/gate";
import {
  saveSdfSettings,
  createDpia,
  addAuditor,
  saveAuditSchedule,
  completeAudit,
  type SdfSettings,
} from "@/lib/sdf/store";

export interface SdfActionResult {
  ok?: boolean;
  error?: string;
}

async function guard() {
  const session = await requireSession();
  const blocked = await guardWrite(session);
  if (blocked) return { session: null, error: blocked };
  return { session, error: null as string | null };
}

export async function updateSdfSettings(raw: SdfSettings): Promise<SdfActionResult> {
  const { session, error } = await guard();
  if (!session) return { error: error ?? "Not allowed." };
  await saveSdfSettings(session.orgId, session.userId, {
    isSdf: raw.isSdf === true,
    dpoIndiaBased: raw.dpoIndiaBased === true,
    dpoName: String(raw.dpoName ?? "").slice(0, 160),
    dpoEmail: String(raw.dpoEmail ?? "").slice(0, 160),
  });
  revalidatePath("/dashboard/compliance/sdf");
  return { ok: true };
}

export async function addDpia(title: string, content: Record<string, string>, final: boolean): Promise<SdfActionResult> {
  const { session, error } = await guard();
  if (!session) return { error: error ?? "Not allowed." };
  if (!title.trim()) return { error: "Give the DPIA a title." };
  await createDpia(session.orgId, session.userId, {
    title: title.trim(),
    content,
    status: final ? "final" : "draft",
  });
  revalidatePath("/dashboard/compliance/sdf");
  return { ok: true };
}

export async function addAuditorRecord(name: string, firm: string, contactEmail: string): Promise<SdfActionResult> {
  const { session, error } = await guard();
  if (!session) return { error: error ?? "Not allowed." };
  if (!name.trim()) return { error: "Add the auditor's name." };
  await addAuditor(session.orgId, session.userId, {
    name: name.trim(),
    firm: firm.trim() || null,
    contactEmail: contactEmail.trim() || null,
  });
  revalidatePath("/dashboard/compliance/sdf");
  return { ok: true };
}

export async function setAuditCadence(cadenceDays: number): Promise<SdfActionResult> {
  const { session, error } = await guard();
  if (!session) return { error: error ?? "Not allowed." };
  await saveAuditSchedule(session.orgId, session.userId, cadenceDays);
  revalidatePath("/dashboard/compliance/sdf");
  return { ok: true };
}

export async function markAuditComplete(): Promise<SdfActionResult> {
  const { session, error } = await guard();
  if (!session) return { error: error ?? "Not allowed." };
  await completeAudit(session.orgId, session.userId);
  revalidatePath("/dashboard/compliance/sdf");
  return { ok: true };
}
