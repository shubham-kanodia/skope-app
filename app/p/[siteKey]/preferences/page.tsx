import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicSiteByKey } from "@/lib/sites/by-key";
import { getLatestPublishedNotice } from "@/lib/notices/store";
import { contactFromSettings } from "@/lib/contact/settings";
import { PublicShell } from "@/components/public/public-shell";
import { Callout } from "@/components/ui/callout";
import { RightsForm } from "./rights-form";

export const metadata: Metadata = {
  title: "Your privacy choices",
  robots: { index: false, follow: false },
};

export default async function PreferencesPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteKey: string }>;
  searchParams: Promise<{ request?: string }>;
}) {
  const { siteKey } = await params;
  const { request } = await searchParams;
  const site = await getPublicSiteByKey(siteKey);
  if (!site || site.status === "archived") notFound();

  const contact = contactFromSettings(site.settings);
  const hasPolicy = (await getLatestPublishedNotice(site.id)) !== null;

  return (
    <PublicShell orgName={site.orgName} domain={site.domain}>
      <p className="text-sm text-muted">Your privacy at {site.domain}</p>
      <h1 className="mt-1 text-[2rem] leading-tight">Privacy choices and requests</h1>

      {request === "verified" && (
        <div className="mt-6">
          <Callout tone="success" title="Request confirmed">
            Thanks, we&apos;ve verified it&apos;s you. We&apos;ll handle your request and follow up by email.
          </Callout>
        </div>
      )}
      {request === "invalid" && (
        <div className="mt-6">
          <Callout tone="warn" title="That link didn't work">
            The confirmation link was invalid or already used. Submit your request again below.
          </Callout>
        </div>
      )}

      <section className="mt-10">
        <h2 className="text-lg text-ink">Cookie and tracking choices</h2>
        <p className="mt-2 text-body">
          You control cookies and trackers from the consent banner on {site.domain}. Open the site
          and use the &quot;Privacy choices&quot; control, or the banner, to change or withdraw your
          consent at any time. Your choice takes effect immediately.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg text-ink">Exercise your rights</h2>
        <p className="mt-2 text-body">
          Under India&apos;s Digital Personal Data Protection Act you can ask to access, correct, or
          erase your data, nominate someone to act for you, or raise a grievance. Tell us what you
          need and we&apos;ll confirm it&apos;s you by email first.
        </p>
        <div className="mt-5">
          <RightsForm siteKey={siteKey} />
        </div>
      </section>

      {(contact.grievanceName || contact.grievanceEmail || contact.dpoEmail) && (
        <section className="mt-10 rounded-2xl border border-hairline p-6">
          <h2 className="text-base text-ink">Who to contact</h2>
          {(contact.grievanceName || contact.grievanceEmail) && (
            <div className="mt-3 text-sm text-body">
              <p className="font-medium text-ink">Grievance officer</p>
              {contact.grievanceName && <p>{contact.grievanceName}</p>}
              {contact.grievanceEmail && (
                <a href={`mailto:${contact.grievanceEmail}`} className="text-primary hover:text-primary-active">
                  {contact.grievanceEmail}
                </a>
              )}
              {contact.grievancePhone && <p>{contact.grievancePhone}</p>}
            </div>
          )}
          {(contact.dpoName || contact.dpoEmail) && (
            <div className="mt-4 text-sm text-body">
              <p className="font-medium text-ink">Data Protection Officer</p>
              {contact.dpoName && <p>{contact.dpoName}</p>}
              {contact.dpoEmail && (
                <a href={`mailto:${contact.dpoEmail}`} className="text-primary hover:text-primary-active">
                  {contact.dpoEmail}
                </a>
              )}
            </div>
          )}
        </section>
      )}

      {hasPolicy && (
        <div className="mt-8">
          <Link href={`/p/${siteKey}/privacy`} className="text-sm font-medium text-primary hover:text-primary-active">
            Read the full privacy notice →
          </Link>
        </div>
      )}
    </PublicShell>
  );
}
