import Link from "next/link";
import { requireSession } from "@/lib/auth/guard";
import { listSites } from "@/lib/orgs/queries";
import { listBatches } from "@/lib/retro/store";
import { Callout } from "@/components/ui/callout";
import { RetroForm } from "./retro-form";

const when = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });

export default async function RetrospectivePage() {
  const session = await requireSession();
  const [sites, batches] = await Promise.all([listSites(session.orgId), listBatches(session.orgId)]);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/dashboard/compliance" className="text-sm text-muted hover:text-ink">
          ← Compliance
        </Link>
        <h1 className="mt-1 text-[2rem] leading-tight">Notify existing contacts</h1>
        <p className="mt-1 text-body">
          If you collected personal data before the law began, you need to send those people your
          privacy notice. Send it once to your existing contacts here, and Skope keeps a record of who
          received it as your proof.
        </p>
      </div>

      <Callout tone="info" title="Publish your notice first">
        Recipients get a link to the site&apos;s published privacy notice, so make sure it&apos;s live
        before you send.
      </Callout>

      {sites.length === 0 ? (
        <Callout tone="warn" title="No sites yet">
          Add a site and publish its notice before sending a retrospective broadcast.
        </Callout>
      ) : (
        <RetroForm sites={sites.map((s) => ({ id: s.id, domain: s.domain }))} />
      )}

      {batches.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg text-ink">Past broadcasts</h2>
          {batches.map((b) => (
            <div key={b.id} className="rounded-2xl border border-hairline p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-ink">{b.domain}</span>
                <span className="text-xs text-muted">{when.format(new Date(b.createdAt))}</span>
              </div>
              <p className="mt-1 text-body">
                {b.sent} sent · {b.queued} queued · {b.failed} failed · {b.total} total
              </p>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
