import { randomBytes, createHash } from "node:crypto";
import { sql } from "@/lib/db/client";
import { sendEmail } from "@/lib/email/send";
import { getOrgWithEntitlement } from "@/lib/orgs/queries";
import { getLimits, planAllowsTeam } from "@/lib/plans";
import type { OrgPlan } from "@/lib/entitlement";

const TTL_DAYS = 14;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type InviteRole = "admin" | "viewer";

export interface Member {
  id: string;
  email: string;
  role: string;
  createdAt: string;
}
export interface PendingInvite {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  expiresAt: string;
}

export async function listMembers(orgId: string): Promise<Member[]> {
  const rows = await sql`
    select id, email, role, created_at from users where org_id = ${orgId} order by created_at`;
  return rows.map((r) => ({
    id: r.id as string,
    email: r.email as string,
    role: r.role as string,
    createdAt: r.created_at as string,
  }));
}

export async function listPendingInvites(orgId: string): Promise<PendingInvite[]> {
  const rows = await sql`
    select id, email, role, created_at, expires_at from org_invites
    where org_id = ${orgId} and accepted_at is null and expires_at > now()
    order by created_at desc`;
  return rows.map((r) => ({
    id: r.id as string,
    email: r.email as string,
    role: r.role as string,
    createdAt: r.created_at as string,
    expiresAt: r.expires_at as string,
  }));
}

export interface SeatInfo {
  used: number;
  total: number;
}

/** Seats used = current members + outstanding invites, against the plan cap. */
export async function getSeatInfo(orgId: string, tier: OrgPlan): Promise<SeatInfo> {
  const [members, invites] = await Promise.all([listMembers(orgId), listPendingInvites(orgId)]);
  return { used: members.length + invites.length, total: getLimits(tier).teamSeats };
}

export interface InviteResult {
  ok?: true;
  error?: string;
}

export async function createInvite(
  orgId: string,
  invitedBy: string,
  emailRaw: string,
  role: InviteRole,
): Promise<InviteResult> {
  const email = emailRaw.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email." };
  if (role !== "admin" && role !== "viewer") return { error: "Pick a role." };

  const data = await getOrgWithEntitlement(orgId);
  if (!data) return { error: "Organisation not found." };
  if (!planAllowsTeam(data.entitlement.tier)) {
    return { error: "Team members are available on the Growth and Scale plans." };
  }

  const existingUser = await sql`select 1 from users where email = ${email} limit 1`;
  if (existingUser[0]) return { error: "That email already has a Skope account." };

  const existingInvite = await sql`
    select 1 from org_invites
    where org_id = ${orgId} and lower(email) = ${email} and accepted_at is null and expires_at > now()
    limit 1`;
  if (existingInvite[0]) return { error: "There's already a pending invite for that email." };

  const seats = await getSeatInfo(orgId, data.entitlement.tier);
  if (seats.used >= seats.total) {
    return { error: `You've used all ${seats.total} seats on your plan. Upgrade or remove a member first.` };
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_DAYS * 86_400_000);
  await sql`
    insert into org_invites (org_id, email, role, token_hash, invited_by, expires_at)
    values (${orgId}, ${email}, ${role}, ${hashToken(token)}, ${invitedBy}, ${expiresAt})`;

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const url = `${base}/invite/${token}`;
  await sendEmail({
    to: email,
    subject: `You're invited to ${data.org.name} on Skope`,
    text: `You've been invited to join ${data.org.name} on Skope as a ${role}.\n\nAccept your invite:\n${url}\n\nThis invite expires in ${TTL_DAYS} days.`,
    html: `<p>You've been invited to join <strong>${escapeHtml(data.org.name)}</strong> on Skope as a ${role}.</p><p><a href="${url}" style="display:inline-block;background:#0052ff;color:#fff;text-decoration:none;padding:12px 20px;border-radius:100px">Accept invite</a></p><p style="color:#5b616e;font-size:14px">This invite expires in ${TTL_DAYS} days.</p>`,
  });

  return { ok: true };
}

export async function revokeInvite(orgId: string, inviteId: string): Promise<void> {
  await sql`delete from org_invites where id = ${inviteId} and org_id = ${orgId} and accepted_at is null`;
}

export async function removeMember(orgId: string, userId: string): Promise<InviteResult> {
  const rows = await sql`select role from users where id = ${userId} and org_id = ${orgId} limit 1`;
  if (!rows[0]) return { error: "Member not found." };
  if (rows[0].role === "owner") return { error: "You can't remove the owner." };
  await sql`delete from users where id = ${userId} and org_id = ${orgId}`;
  return { ok: true };
}

export interface InviteView {
  orgName: string;
  email: string;
  role: string;
}

/** For the public invite landing page: who invited you and to what. */
export async function getInviteByToken(token: string): Promise<InviteView | null> {
  const rows = await sql`
    select o.name as org_name, i.email, i.role
    from org_invites i join orgs o on o.id = i.org_id
    where i.token_hash = ${hashToken(token)} and i.accepted_at is null and i.expires_at > now()
    limit 1`;
  if (!rows[0]) return null;
  return { orgName: rows[0].org_name as string, email: rows[0].email as string, role: rows[0].role as string };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
}
