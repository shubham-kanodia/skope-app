"use client";

import { useState } from "react";
import { inviteMember, revokeInviteAction, removeMemberAction } from "./actions";
import type { Member, PendingInvite, SeatInfo, InviteRole } from "@/lib/team/invites";

const ROLE_LABEL: Record<string, string> = { owner: "Owner", admin: "Admin", viewer: "Viewer" };

export function TeamManager({
  members,
  invites,
  seats,
  canManage,
  selfId,
}: {
  members: Member[];
  invites: PendingInvite[];
  seats: SeatInfo;
  canManage: boolean;
  selfId: string;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("viewer");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const seatsFull = seats.used >= seats.total;

  async function onInvite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await inviteMember(email, role);
    setBusy(false);
    if (res.error) return setMsg({ kind: "err", text: res.error });
    setEmail("");
    setMsg({ kind: "ok", text: "Invite sent." });
  }

  return (
    <div className="max-w-2xl space-y-8">
      {canManage && (
        <form onSubmit={onInvite} className="rounded-2xl border border-hairline p-5">
          <p className="text-sm font-medium text-ink">Invite a teammate</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => { setEmail(e.target.value); setMsg(null); }}
              placeholder="teammate@yourstore.in"
              disabled={seatsFull}
              className="flex-1 rounded-xl border border-hairline bg-canvas px-4 py-2.5 text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-surface-soft"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as InviteRole)}
              disabled={seatsFull}
              className="rounded-xl border border-hairline bg-canvas px-3 py-2.5 text-ink outline-none focus:border-primary disabled:bg-surface-soft"
            >
              <option value="viewer">Viewer</option>
              <option value="admin">Admin</option>
            </select>
            <button
              type="submit"
              disabled={busy || seatsFull}
              className="rounded-full bg-primary px-5 py-2.5 font-medium text-white transition-colors hover:bg-primary-active disabled:opacity-60"
            >
              {busy ? "Sending…" : "Send invite"}
            </button>
          </div>
          {seatsFull && (
            <p className="mt-2 text-sm text-muted">
              All {seats.total} seats are in use. Remove a member or upgrade your plan to add more.
            </p>
          )}
          {msg && <p className={`mt-2 text-sm ${msg.kind === "err" ? "text-ink" : "text-success"}`}>{msg.text}</p>}
        </form>
      )}

      <section>
        <h2 className="text-sm font-medium text-ink">Members</h2>
        <ul className="mt-3 space-y-2">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between rounded-xl border border-hairline px-4 py-3">
              <div>
                <p className="text-sm text-ink">{m.email}</p>
                <p className="text-xs text-muted">{ROLE_LABEL[m.role] ?? m.role}</p>
              </div>
              {canManage && m.role !== "owner" && m.id !== selfId && (
                <RemoveButton userId={m.id} />
              )}
            </li>
          ))}
        </ul>
      </section>

      {invites.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-ink">Pending invites</h2>
          <ul className="mt-3 space-y-2">
            {invites.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between rounded-xl border border-dashed border-hairline px-4 py-3">
                <div>
                  <p className="text-sm text-ink">{inv.email}</p>
                  <p className="text-xs text-muted">{ROLE_LABEL[inv.role] ?? inv.role} · invited</p>
                </div>
                {canManage && <RevokeButton inviteId={inv.id} />}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function RemoveButton({ userId }: { userId: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      onClick={async () => { setBusy(true); await removeMemberAction(userId); setBusy(false); }}
      disabled={busy}
      className="text-sm text-muted hover:text-ink disabled:opacity-60"
    >
      {busy ? "Removing…" : "Remove"}
    </button>
  );
}

function RevokeButton({ inviteId }: { inviteId: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      onClick={async () => { setBusy(true); await revokeInviteAction(inviteId); setBusy(false); }}
      disabled={busy}
      className="text-sm text-muted hover:text-ink disabled:opacity-60"
    >
      {busy ? "Revoking…" : "Revoke"}
    </button>
  );
}
