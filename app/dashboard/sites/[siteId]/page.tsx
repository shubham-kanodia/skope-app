import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/guard";
import { getSiteForOrg } from "@/lib/orgs/queries";
import { mergeBannerSettings } from "@/lib/banner/settings";
import { contactFromSettings, hasGrievanceContact } from "@/lib/contact/settings";
import { retentionFromSettings } from "@/lib/retention/settings";
import { childrenFromSettings } from "@/lib/children/settings";
import { exemptionsFromSettings } from "@/lib/exemptions/settings";
import { listDataItems } from "@/lib/data-items/store";
import { getLatestNotice } from "@/lib/notices/store";
import { getSetupState } from "@/lib/sites/setup";
import { Tooltip } from "@/components/ui/tooltip";
import { listRecipients } from "@/lib/recipients/store";
import { SiteWizard } from "./site-wizard";
import { RetentionSettingsEditor } from "./retention-settings";
import { ChildrenSettingsEditor } from "./children-settings";
import { ExemptionSettingsEditor } from "./exemptions-settings";
import { RecipientsEditor } from "./recipients/recipients-editor";

export default async function SitePage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const session = await requireSession();
  const site = await getSiteForOrg(siteId, session.orgId);
  if (!site) notFound();

  const banner = mergeBannerSettings((site.settings as { banner?: unknown }).banner);
  const contact = contactFromSettings(site.settings);
  const latestNotice = await getLatestNotice(site.id);
  const dataItems = await listDataItems(site.id);
  const recipients = await listRecipients(site.id);
  const setup = await getSetupState(site.id, site.settings, site.last_seen_at);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard" className="text-sm text-muted hover:text-ink">
          ← Sites
        </Link>
        <h1 className="mt-2 text-[2rem] leading-tight">{site.domain}</h1>
        <div className="mt-1 flex items-center gap-1 font-mono text-xs text-muted">
          {site.site_key}
          <Tooltip term="siteKey" />
        </div>
      </div>

      <SiteWizard
        siteId={site.id}
        siteKey={site.site_key}
        domain={site.domain}
        banner={banner}
        contact={contact}
        dataItems={dataItems}
        latestNotice={latestNotice}
        contactReady={hasGrievanceContact(contact)}
        initial={setup}
      />

      <div className="border-t border-hairline pt-8">
        <h2 className="text-xl text-ink">Go further</h2>
        <p className="mt-1 max-w-2xl text-sm text-body">
          The steps above get you live. These settings tailor your site to the rest of your DPDP
          duties. Set the ones that apply to you, you can come back to them any time.
        </p>
      </div>

      <RetentionSettingsEditor siteId={site.id} initial={retentionFromSettings(site.settings)} />

      <ChildrenSettingsEditor siteId={site.id} initial={childrenFromSettings(site.settings)} />

      <RecipientsEditor
        siteId={site.id}
        initial={recipients}
        dataItems={dataItems.map((d) => ({ key: d.key, name: d.name.en ?? d.key }))}
      />

      <ExemptionSettingsEditor siteId={site.id} initial={exemptionsFromSettings(site.settings)} />
    </div>
  );
}
