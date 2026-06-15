import Link from "next/link";
import { requireSession } from "@/lib/auth/guard";
import { listRecipientsForOrg, type RecipientWithSite } from "@/lib/recipients/store";
import { ROLE_LABELS } from "@/lib/recipients/types";
import { isRestrictedCountry } from "@/lib/recipients/restricted-countries";
import { EmptyState } from "@/components/ui/empty-state";
import { Callout } from "@/components/ui/callout";

function processorsMissingContract(rows: RecipientWithSite[]): RecipientWithSite[] {
  return rows.filter((r) => r.role === "processor" && (!r.contractRef || r.contractStatus !== "signed"));
}

export default async function RecipientsPage() {
  const session = await requireSession();
  const recipients = await listRecipientsForOrg(session.orgId);
  const missing = processorsMissingContract(recipients);
  const restricted = recipients.filter((r) => isRestrictedCountry(r.country));

  // Group by site for display.
  const bySite = new Map<string, { domain: string; siteId: string; rows: RecipientWithSite[] }>();
  for (const r of recipients) {
    const g = bySite.get(r.siteId) ?? { domain: r.domain, siteId: r.siteId, rows: [] };
    g.rows.push(r);
    bySite.set(r.siteId, g);
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/compliance" className="text-sm text-muted hover:text-ink">
          ← Compliance
        </Link>
        <h1 className="mt-1 text-[2rem] leading-tight">Who you share data with</h1>
        <p className="mt-1 max-w-2xl text-body">
          Everyone you share personal data with. Add and edit each site&apos;s list on its own page,
          this is the combined view across your sites, used to answer access requests and for your
          records.
        </p>
      </div>

      {missing.length > 0 && (
        <Callout tone="warn" title={`${missing.length} vendor(s) without a signed contract`}>
          You need a signed contract with every vendor that handles data for you. Add a contract
          reference for: {missing.map((r) => r.name).join(", ")}.
        </Callout>
      )}
      {restricted.length > 0 && (
        <Callout tone="warn" title="Restricted country">
          The government restricts sending data to a country one or more of these recipients are in.
          Check before you share.
        </Callout>
      )}

      {recipients.length === 0 ? (
        <EmptyState
          title="No recipients declared yet."
          hint="Open a site and add its processors and partners under the recipients register, so they appear in your notice and access responses."
        />
      ) : (
        <div className="space-y-6">
          {[...bySite.values()].map((g) => (
            <div key={g.siteId}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg text-ink">{g.domain}</h2>
                <Link href={`/dashboard/sites/${g.siteId}`} className="text-sm text-primary hover:text-primary-active">
                  Edit
                </Link>
              </div>
              <div className="mt-2 space-y-2">
                {g.rows.map((r) => (
                  <div key={r.id} className="rounded-xl border border-hairline p-4 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-ink">{r.name}</span>
                      <span className="rounded-full bg-surface-strong px-2 py-0.5 text-xs text-ink">
                        {ROLE_LABELS[r.role]}
                      </span>
                      {r.country && (
                        <span className={`text-xs ${isRestrictedCountry(r.country) ? "text-amber" : "text-muted"}`}>
                          {r.country}
                        </span>
                      )}
                    </div>
                    {r.purpose && <p className="mt-1 text-body">{r.purpose}</p>}
                    {r.dataItemKeys.length > 0 && (
                      <p className="mt-1 text-xs text-muted">Data shared: {r.dataItemKeys.join(", ")}</p>
                    )}
                    {r.role === "processor" && (
                      <p className="mt-1 text-xs text-muted">
                        Contract: {r.contractRef ? `${r.contractRef} (${r.contractStatus ?? "status unset"})` : "none on file"}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
