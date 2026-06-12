import { randomBytes } from "node:crypto";
import { sql } from "@/lib/db/client";
import type { ComplianceReport } from "./analyze";

/** Persist a scan and return its public report token. */
export async function createScan(report: ComplianceReport): Promise<string> {
  const token = randomBytes(18).toString("base64url");
  await sql`
    insert into compliance_scans (report_token, domain, scanned_url, score, report)
    values (${token}, ${report.domain}, ${report.scannedUrl}, ${report.score},
            ${sql.json(JSON.parse(JSON.stringify(report)))})`;
  return token;
}

/** Attach a lead email to a scan (idempotent-ish). Returns the domain or null. */
export async function attachEmail(token: string, email: string): Promise<string | null> {
  const rows = await sql`
    update compliance_scans
       set email = ${email}, emailed_at = now()
     where report_token = ${token}
    returning domain`;
  return (rows[0]?.domain as string | undefined) ?? null;
}

export async function getScanByToken(
  token: string,
): Promise<{ report: ComplianceReport; createdAt: string } | null> {
  const rows = await sql`
    select report, created_at from compliance_scans where report_token = ${token} limit 1`;
  if (!rows[0]) return null;
  return { report: rows[0].report as ComplianceReport, createdAt: rows[0].created_at as string };
}
