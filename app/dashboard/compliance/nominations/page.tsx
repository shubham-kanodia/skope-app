import Link from "next/link";
import { requireSession } from "@/lib/auth/guard";
import { listSites } from "@/lib/orgs/queries";
import { listNominations } from "@/lib/nominations/store";
import { Callout } from "@/components/ui/callout";
import { NominationsManager } from "./nominations-manager";

export default async function NominationsPage() {
  const session = await requireSession();
  const [sites, nominations] = await Promise.all([listSites(session.orgId), listNominations(session.orgId)]);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/dashboard/compliance" className="text-sm text-muted hover:text-ink">
          ← Compliance
        </Link>
        <h1 className="mt-1 text-[2rem] leading-tight">Nominees</h1>
        <p className="mt-1 text-body">
          Someone can choose a person to act for them if they die or can&apos;t act for themselves.
          Record that nominee here, and switch it on (with proof) when the time comes. Nominee details
          are encrypted.
        </p>
      </div>

      {sites.length === 0 ? (
        <Callout tone="warn" title="No sites yet">
          Add a site before recording nominations.
        </Callout>
      ) : (
        <NominationsManager sites={sites.map((s) => ({ id: s.id, domain: s.domain }))} initial={nominations} />
      )}
    </div>
  );
}
