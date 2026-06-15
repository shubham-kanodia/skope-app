import type { ContactSettings } from "@/lib/contact/settings";
import type { BreachRow } from "./types";

/**
 * Deterministic breach-notice drafts (DPDP §8(6)). One for the Data Protection
 * Board, one for affected Data Principals, built from the incident and the
 * site's published contact details.
 *
 * [HUMAN] The §8(6) "prescribed form and manner" and the Board's submission
 * channel are set by the DPDP Rules and were not finalised when this was
 * written. These are working drafts with clearly-flagged placeholders, counsel
 * must review, and the Board form must be reconciled with the notified format
 * before anything is sent.
 */
export interface BreachNoticeDraft {
  subject: string;
  body: string;
}

function entityName(contact: ContactSettings, domain: string | null): string {
  return contact.entityName || domain || "the organisation";
}

function categoriesLine(categories: string[]): string {
  return categories.length > 0 ? categories.join(", ") : "[HUMAN: list the categories of data involved]";
}

function grievanceBlock(contact: ContactSettings): string {
  const lines = [
    contact.grievanceName && `Grievance Officer: ${contact.grievanceName}`,
    contact.grievanceEmail && `Email: ${contact.grievanceEmail}`,
    contact.grievancePhone && `Phone: ${contact.grievancePhone}`,
  ].filter(Boolean);
  return lines.length > 0 ? lines.join("\n") : "[HUMAN: add your grievance officer's name and a working email]";
}

/** Notice to the Data Protection Board of India. */
export function boardBreachNotice(incident: BreachRow, contact: ContactSettings): BreachNoticeDraft {
  const who = entityName(contact, incident.domain);
  const detected = new Date(incident.detectedAt).toISOString().replace("T", " ").slice(0, 16) + " UTC";
  const affected =
    incident.estAffected != null ? `${incident.estAffected}` : "[HUMAN: estimated number of affected people]";

  return {
    subject: `Personal data breach intimation, ${who}`,
    body: [
      `To: The Data Protection Board of India`,
      `[HUMAN: submit through the Board's notified channel / prescribed form once available.]`,
      ``,
      `1. Data Fiduciary: ${who} (${incident.domain ?? "[domain]"}).`,
      `2. Nature of the breach: ${incident.nature}`,
      `3. Categories of personal data involved: ${categoriesLine(incident.dataCategories)}.`,
      `4. Estimated number of Data Principals affected: ${affected}.`,
      `5. Date and time the breach was detected: ${detected}.`,
      `6. Measures taken or proposed to remediate and mitigate harm: ${
        incident.remediation || "[HUMAN: describe remediation and mitigation steps]"
      }`,
      ``,
      `Contact for this intimation:`,
      grievanceBlock(contact),
      ``,
      `[HUMAN: confirm all fields against the prescribed form before submitting; have counsel review.]`,
    ].join("\n"),
  };
}

/** Notice to each affected Data Principal. */
export function principalBreachNotice(incident: BreachRow, contact: ContactSettings): BreachNoticeDraft {
  const who = entityName(contact, incident.domain);

  return {
    subject: `Important: a security incident affecting your personal data`,
    body: [
      `Dear customer,`,
      ``,
      `We are writing to let you know about a personal data breach at ${who} that may affect you, as required under India's Digital Personal Data Protection Act, 2023.`,
      ``,
      `What happened: ${incident.nature}`,
      ``,
      `What information was involved: ${categoriesLine(incident.dataCategories)}.`,
      ``,
      `What we are doing: ${
        incident.remediation || "[HUMAN: describe what you are doing to address this and protect people]"
      }`,
      ``,
      `What you can do: [HUMAN: add concrete steps, e.g. reset your password, watch for suspicious activity, contact your bank.]`,
      ``,
      `If you have questions or concerns, contact us:`,
      grievanceBlock(contact),
      ``,
      `You may also complain to the Data Protection Board of India.`,
      ``,
      `We take the protection of your personal data seriously and apologise for any concern this may cause.`,
      ``,
      `, ${who}`,
    ].join("\n"),
  };
}
