import Link from "next/link";
import { requireSession } from "@/lib/auth/guard";
import { listSites } from "@/lib/orgs/queries";
import { BreachForm } from "../breach-form";

export default async function NewBreachPage() {
  const session = await requireSession();
  const sites = await listSites(session.orgId);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/dashboard/compliance/breach" className="text-sm text-muted hover:text-ink">
          ← Breach reporting
        </Link>
        <h1 className="mt-1 text-[2rem] leading-tight">Record a breach</h1>
        <p className="mt-1 text-body">
          Capture what you know now. You can update details and generate the notices on the next
          screen.
        </p>
      </div>
      <BreachForm sites={sites.map((s) => ({ id: s.id, domain: s.domain }))} />
    </div>
  );
}
