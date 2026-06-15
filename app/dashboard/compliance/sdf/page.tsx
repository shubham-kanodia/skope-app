import Link from "next/link";
import { requireSession } from "@/lib/auth/guard";
import { getSdfSettings, listDpia, listAuditors, getAuditSchedule } from "@/lib/sdf/store";
import { Callout } from "@/components/ui/callout";
import { SdfManager } from "./sdf-manager";

export default async function SdfPage() {
  const session = await requireSession();
  const [settings, dpias, auditors, schedule] = await Promise.all([
    getSdfSettings(session.orgId),
    listDpia(session.orgId),
    listAuditors(session.orgId),
    getAuditSchedule(session.orgId),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/dashboard/compliance" className="text-sm text-muted hover:text-ink">
          ← Compliance
        </Link>
        <h1 className="mt-1 text-[2rem] leading-tight">Significant Data Fiduciary</h1>
        <p className="mt-1 text-body">
          The government can name large businesses, or ones handling sensitive data, as
          &quot;significant&quot;. If that&apos;s you, you have extra duties: a data protection officer
          based in India, an independent auditor, and regular risk assessments.
        </p>
      </div>

      <Callout tone="info" title="Most businesses are not SDFs">
        Only turn this on if you&apos;ve been formally notified. If you&apos;re unsure, check with
        your counsel before designating.
      </Callout>

      <SdfManager settings={settings} dpias={dpias} auditors={auditors} schedule={schedule} />
    </div>
  );
}
