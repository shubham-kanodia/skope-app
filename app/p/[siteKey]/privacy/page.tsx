import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicSiteByKey } from "@/lib/sites/by-key";
import { getLatestPublishedNotice } from "@/lib/notices/store";
import { contactFromSettings } from "@/lib/contact/settings";
import { PublicShell, Prose } from "@/components/public/public-shell";

export const metadata: Metadata = {
  title: "Privacy notice",
  robots: { index: false, follow: false },
};

const when = new Intl.DateTimeFormat("en-IN", { dateStyle: "long", timeZone: "Asia/Kolkata" });

export default async function PrivacyPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteKey: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { siteKey } = await params;
  const { lang } = await searchParams;
  const site = await getPublicSiteByKey(siteKey);
  if (!site || site.status === "archived") notFound();

  const notice = await getLatestPublishedNotice(site.id);
  if (!notice) notFound();

  const language = lang && notice.contentI18n[lang] ? lang : site.defaultLanguage;
  const content = notice.contentI18n[language] ?? notice.contentI18n.en ?? Object.values(notice.contentI18n)[0];
  if (!content) notFound();

  const contact = contactFromSettings(site.settings);

  return (
    <PublicShell orgName={site.orgName} domain={site.domain}>
      <p className="text-sm text-muted">Privacy notice</p>
      <h1 className="mt-1 text-[2rem] leading-tight">{content.title}</h1>
      {notice.publishedAt && (
        <p className="mt-1 text-sm text-muted">Last updated {when.format(new Date(notice.publishedAt))} (IST)</p>
      )}

      <div className="mt-6 space-y-8">
        {content.intro && <Prose text={content.intro} />}
        {content.sections.map((s, i) => (
          <section key={i}>
            <h2 className="text-lg text-ink">{s.heading}</h2>
            <div className="mt-2">
              <Prose text={s.body} />
            </div>
          </section>
        ))}
      </div>

      {(contact.grievanceName || contact.grievanceEmail) && (
        <div className="mt-10 rounded-2xl border border-hairline p-6">
          <h2 className="text-base text-ink">Grievance officer</h2>
          <div className="mt-2 space-y-0.5 text-sm text-body">
            {contact.grievanceName && <p>{contact.grievanceName}</p>}
            {contact.grievanceEmail && (
              <p>
                <a href={`mailto:${contact.grievanceEmail}`} className="text-primary hover:text-primary-active">
                  {contact.grievanceEmail}
                </a>
              </p>
            )}
            {contact.grievancePhone && <p>{contact.grievancePhone}</p>}
            {contact.grievanceAddress && <p className="whitespace-pre-line">{contact.grievanceAddress}</p>}
          </div>
        </div>
      )}

      <div className="mt-8">
        <Link
          href={`/p/${siteKey}/preferences`}
          className="inline-block rounded-full bg-primary px-5 py-2.5 font-medium text-white hover:bg-primary-active"
        >
          Manage your privacy choices
        </Link>
      </div>
    </PublicShell>
  );
}
