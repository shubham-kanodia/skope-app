import Link from "next/link";
import { requireSession } from "@/lib/auth/guard";
import { getOrgGate } from "@/lib/billing/gate";
import { planAllowsTeam } from "@/lib/plans";
import { listMembers, listPendingInvites, getSeatInfo } from "@/lib/team/invites";
import { Callout } from "@/components/ui/callout";
import { TeamManager } from "./team-manager";

export default async function TeamPage() {
  const session = await requireSession();
  const gate = await getOrgGate(session.orgId);
  const tier = gate?.entitlement.tier ?? "free";

  if (!planAllowsTeam(tier)) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-[2rem] leading-tight">Team</h1>
          <p className="mt-1 text-body">Invite teammates to help manage consent and requests.</p>
        </div>
        <Callout tone="info" title="Team members are a Growth feature">
          Invite admins and viewers on the Growth and Scale plans.{" "}
          <Link href="/dashboard/billing" className="font-medium text-primary hover:text-primary-active">
            See plans
          </Link>
          .
        </Callout>
      </div>
    );
  }

  const [members, invites, seats] = await Promise.all([
    listMembers(session.orgId),
    listPendingInvites(session.orgId),
    getSeatInfo(session.orgId, tier),
  ]);
  const canManage = session.role === "owner" || session.role === "admin";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[2rem] leading-tight">Team</h1>
        <p className="mt-1 text-body">
          Invite teammates as admins (can edit) or viewers (read-only). {seats.used} of {seats.total} seats used.
        </p>
      </div>
      <TeamManager
        members={members}
        invites={invites}
        seats={seats}
        canManage={canManage}
        selfId={session.userId}
      />
    </div>
  );
}
