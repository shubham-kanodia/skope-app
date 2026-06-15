import Link from "next/link";
import { requireSession } from "@/lib/auth/guard";
import { Callout } from "@/components/ui/callout";

/**
 * Compliance hub, one place for the DPDP obligations that sit outside the
 * day-to-day banner/records/requests flow: breach reporting, the erasure-due
 * queue, the recipients register, cross-border transfers, and (for SDFs) the
 * DPIA/auditor toolkit. Each card links to its own workspace.
 */

type HubCard = {
  href: string;
  title: string;
  blurb: string;
  section: string;
};

const CARDS: HubCard[] = [
  {
    href: "/dashboard/compliance/breach",
    title: "Report a breach",
    blurb:
      "If personal data is exposed or leaked, record what happened and send the right notices to the regulator and the people affected.",
    section: "If something goes wrong",
  },
  {
    href: "/dashboard/compliance/erasure",
    title: "Data to delete",
    blurb:
      "See whose data is due for deletion, after they withdraw or go inactive, and tick each one off once it's done.",
    section: "Keep only what you need",
  },
  {
    href: "/dashboard/compliance/recipients",
    title: "Who you share data with",
    blurb:
      "List the companies you share data with and what you share. This feeds your privacy notice and your answers to access requests.",
    section: "Who you share with",
  },
  {
    href: "/dashboard/compliance/sdf",
    title: "Significant Data Fiduciary",
    blurb:
      "Only if the government has named you one. Record your data protection officer, your independent auditor, and your impact assessments.",
    section: "Extra duties for large players",
  },
  {
    href: "/dashboard/compliance/retrospective",
    title: "Notify existing contacts",
    blurb:
      "Send your privacy notice to people who gave consent before the law began, and keep a record that you did.",
    section: "Existing contacts",
  },
  {
    href: "/dashboard/compliance/nominations",
    title: "Nominees",
    blurb:
      "Record who someone has chosen to act for them if they die or can't act for themselves, and switch it on when needed.",
    section: "Acting for others",
  },
];

export default async function CompliancePage() {
  await requireSession();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[2rem] leading-tight">Compliance</h1>
        <p className="mt-1 text-body">
          The privacy tasks beyond your banner and records. Do the ones that apply to you, most
          businesses won&apos;t need every section.
        </p>
      </div>

      <Callout tone="info" title="Not legal advice">
        Skope helps you do these things and keep proof, but the wording, especially for
        children&apos;s data, breaches, and significant-fiduciary status, should be checked by your
        lawyer before you rely on it.
      </Callout>

      <div className="grid gap-4 sm:grid-cols-2">
        {CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group rounded-2xl border border-hairline bg-surface p-5 transition-colors hover:border-primary/40 hover:bg-surface-soft"
          >
            <p className="text-xs uppercase tracking-wide text-muted">{card.section}</p>
            <p className="mt-1 text-lg text-ink group-hover:text-primary">{card.title}</p>
            <p className="mt-1.5 text-sm text-body">{card.blurb}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
