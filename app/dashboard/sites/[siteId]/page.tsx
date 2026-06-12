import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/guard";
import { getSiteForOrg } from "@/lib/orgs/queries";
import { mergeBannerSettings } from "@/lib/banner/settings";
import { contactFromSettings, hasGrievanceContact } from "@/lib/contact/settings";
import { listDataItems } from "@/lib/data-items/store";
import { getLatestNotice } from "@/lib/notices/store";
import { getSetupState } from "@/lib/sites/setup";
import { Tooltip } from "@/components/ui/tooltip";
import { SiteWizard } from "./site-wizard";

export default async function SitePage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const session = await requireSession();
  const site = await getSiteForOrg(siteId, session.orgId);
  if (!site) notFound();

  const banner = mergeBannerSettings((site.settings as { banner?: unknown }).banner);
  const contact = contactFromSettings(site.settings);
  const latestNotice = await getLatestNotice(site.id);
  const dataItems = await listDataItems(site.id);
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
    </div>
  );
}
