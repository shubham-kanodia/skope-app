import { buildSimplePdf, type PdfLine } from "@/lib/export/pdf";
import { DEFAULT_PURPOSES } from "@/lib/banner/settings";
import { CATEGORY_LABELS, type DataItem } from "@/lib/data-items/types";
import type { ContactSettings } from "@/lib/contact/settings";
import type { Recipient } from "@/lib/recipients/types";

/**
 * Access-request summary (DPDP §11(1)(a)): a summary of the personal data being
 * processed and the processing activities, plus the recipients the data is or
 * may be shared with (§11(1)(b)). Compiled from the site's own declarations,  * data items, purposes, recipients, retention, contacts, into a deliverable PDF
 * the fiduciary sends to the verified requester.
 */
export interface AccessSummaryInput {
  orgName: string;
  domain: string;
  requesterEmail: string | null;
  dataItems: DataItem[];
  recipients: Recipient[];
  contact: ContactSettings;
}

export function buildAccessSummaryPdf(input: AccessSummaryInput): Uint8Array {
  const lines: PdfLine[] = [
    { text: "Summary of personal data we process", size: 18, bold: true },
    { text: "" },
    { text: `Data Fiduciary: ${input.orgName} (${input.domain})` },
    { text: `Prepared for: ${input.requesterEmail ?? "[requester]"}` },
    { text: `Prepared on: ${new Date().toISOString().slice(0, 10)}` },
    { text: "" },
    { text: "This summary is provided under section 11 of the Digital Personal Data Protection Act, 2023.", size: 9 },
    { text: "" },
    { text: "Personal data we collect", size: 14, bold: true },
  ];

  if (input.dataItems.length === 0) {
    lines.push({ text: "No itemised data declared.", size: 11 });
  } else {
    const purposeName = new Map(DEFAULT_PURPOSES.map((p) => [p.key, p.name.en ?? p.key]));
    for (const d of input.dataItems) {
      const retention = d.retentionDays ? `, kept about ${d.retentionDays} days` : "";
      const source = d.sourceLabel ? `, collected at ${d.sourceLabel}` : "";
      lines.push({
        text: `- ${d.name.en ?? d.key} (${CATEGORY_LABELS[d.category]}), for ${purposeName.get(d.purposeKey) ?? d.purposeKey}${source}${retention}`,
      });
    }
  }

  lines.push({ text: "" }, { text: "Purposes we process for", size: 14, bold: true });
  for (const p of DEFAULT_PURPOSES) {
    lines.push({ text: `- ${p.name.en ?? p.key}${p.isEssential ? " (always on, strictly necessary)" : " (only with your consent)"}` });
  }

  lines.push({ text: "" }, { text: "Who we share it with", size: 14, bold: true });
  if (input.recipients.length === 0) {
    lines.push({ text: "We do not share your personal data with third parties, except as required by law." });
  } else {
    for (const r of input.recipients) {
      const role = r.role === "processor" ? "processor" : "data fiduciary";
      const where = r.country ? `, ${r.country}` : "";
      const why = r.purpose ? `, ${r.purpose}` : "";
      const data = r.dataItemKeys.length ? ` [data: ${r.dataItemKeys.join(", ")}]` : "";
      lines.push({ text: `- ${r.name} (${role}${where})${why}${data}` });
    }
  }

  lines.push(
    { text: "" },
    { text: "Your rights", size: 14, bold: true },
    { text: "You can ask us to correct or erase your data, withdraw consent, or nominate someone to act for you. You can also complain to the Data Protection Board of India." },
    { text: "" },
    { text: "Contact", size: 14, bold: true },
  );
  if (input.contact.grievanceName) lines.push({ text: `Grievance Officer: ${input.contact.grievanceName}` });
  if (input.contact.grievanceEmail) lines.push({ text: `Email: ${input.contact.grievanceEmail}` });
  if (input.contact.grievancePhone) lines.push({ text: `Phone: ${input.contact.grievancePhone}` });

  return buildSimplePdf(lines);
}
