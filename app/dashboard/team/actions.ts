"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/guard";
import { createInvite, revokeInvite, removeMember, type InviteRole } from "@/lib/team/invites";

function canManage(role: string): boolean {
  return role === "owner" || role === "admin";
}

export async function inviteMember(email: string, role: InviteRole): Promise<{ ok?: true; error?: string }> {
  const session = await requireSession();
  if (!canManage(session.role)) return { error: "Only owners and admins can invite teammates." };
  const res = await createInvite(session.orgId, session.userId, email, role);
  if (res.ok) revalidatePath("/dashboard/team");
  return res;
}

export async function revokeInviteAction(inviteId: string): Promise<{ ok?: true; error?: string }> {
  const session = await requireSession();
  if (!canManage(session.role)) return { error: "Only owners and admins can manage invites." };
  await revokeInvite(session.orgId, inviteId);
  revalidatePath("/dashboard/team");
  return { ok: true };
}

export async function removeMemberAction(userId: string): Promise<{ ok?: true; error?: string }> {
  const session = await requireSession();
  if (!canManage(session.role)) return { error: "Only owners and admins can remove members." };
  if (userId === session.userId) return { error: "You can't remove yourself." };
  const res = await removeMember(session.orgId, userId);
  if (res.ok) revalidatePath("/dashboard/team");
  return res;
}
