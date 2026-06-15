import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicSiteByKey } from "@/lib/sites/by-key";
import { PublicShell } from "@/components/public/public-shell";
import { ParentalConfirm } from "./confirm";

export const metadata: Metadata = {
  title: "Parental consent",
  robots: { index: false, follow: false },
};

export default async function ParentalConsentPage({
  params,
}: {
  params: Promise<{ siteKey: string; token: string }>;
}) {
  const { siteKey, token } = await params;
  const site = await getPublicSiteByKey(siteKey);
  if (!site || site.status === "archived") notFound();

  const who = site.orgName || site.domain;

  return (
    <PublicShell orgName={site.orgName} domain={site.domain}>
      <p className="text-sm text-muted">Parental consent</p>
      <h1 className="mt-1 text-[2rem] leading-tight">Approve your child&apos;s use of {site.domain}</h1>

      <div className="mt-6 space-y-4 text-body">
        <p>
          A child indicated that you are their parent or guardian. Under India&apos;s Digital Personal
          Data Protection Act, {who} needs your consent before processing a child&apos;s personal data.
        </p>
        <p>
          Please read the{" "}
          <Link href={`/p/${siteKey}/privacy`} className="text-primary hover:text-primary-active" target="_blank">
            privacy notice
          </Link>{" "}
          to see what data is collected and why.
        </p>
        <p className="rounded-xl border border-hairline bg-surface-soft px-4 py-3 text-sm">
          For children, {who} keeps analytics and marketing trackers switched off and does not use a
          child&apos;s data for behavioural monitoring or targeted advertising, as the law requires,           even with your consent. Your consent covers only the essential processing needed to provide
          the service.
        </p>
      </div>

      <div className="mt-8">
        <ParentalConfirm token={token} />
      </div>
    </PublicShell>
  );
}
