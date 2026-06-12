import type { PolicyContent, PolicyInput } from "./types";

/**
 * Deterministic DPDP-aligned privacy-notice draft built from the site's own
 * data. Used when OPENROUTER_API_KEY is unset (local dev, CI) and as the
 * fallback if a live generation fails. [HUMAN] This is a starting template, not
 * legal advice; counsel must review before publishing.
 */
export function templatePolicy(input: PolicyInput): PolicyContent {
  const org = input.orgName || input.domain;

  const purposeLines = input.purposes
    .map((p) => `- ${p.name}: ${p.description}${p.isEssential ? " (always on, strictly necessary)" : " (only with your consent)"}`)
    .join("\n");

  const dataItemLines = input.dataItems
    .map(
      (d) =>
        `- ${d.name}, for ${d.purpose}${d.source ? ` (collected at: ${d.source})` : ""}${d.retentionDays ? `, kept about ${d.retentionDays} days` : ""}`,
    )
    .join("\n");

  const trackerLines =
    input.trackers.length > 0
      ? input.trackers.map((t) => `- ${t.name} (${t.category})`).join("\n")
      : "- We do not currently load third-party trackers, or none were detected.";

  const retentionLines = input.purposes
    .filter((p) => p.retentionDays && p.retentionDays > 0)
    .map((p) => `- ${p.name}: about ${p.retentionDays} days`)
    .join("\n");

  const grievance =
    input.grievanceName || input.grievanceEmail
      ? [
          input.grievanceName && `Name: ${input.grievanceName}`,
          input.grievanceEmail && `Email: ${input.grievanceEmail}`,
          input.grievancePhone && `Phone: ${input.grievancePhone}`,
          input.grievanceAddress && `Address: ${input.grievanceAddress}`,
        ]
          .filter(Boolean)
          .join("\n")
      : "[HUMAN: add your grievance officer's name and a working email]";

  const dpo =
    input.dpoName || input.dpoEmail
      ? `Our Data Protection Officer is ${input.dpoName || "[name]"}${input.dpoEmail ? `, reachable at ${input.dpoEmail}` : ""}.`
      : "If we appoint a Data Protection Officer, their contact details will be published here.";

  return {
    title: "Privacy notice",
    intro: `This notice explains how ${org} ("we") collects and uses your personal data when you use ${input.domain}, and the choices you have under India's Digital Personal Data Protection Act, 2023 (DPDP).`,
    sections: [
      {
        heading: "Who we are",
        body: `${org} operates ${input.domain}. For the personal data described here, we act as the Data Fiduciary, meaning we decide why and how your data is processed.`,
      },
      {
        heading: "What data we collect and why",
        body: `We collect personal data to run this site and, where you agree, for other purposes.${
          dataItemLines
            ? `\n\nThe personal data we collect:\n\n${dataItemLines}`
            : "\n\n[HUMAN: list the personal data your forms collect, like name, email, or phone — declare them in your Skope dashboard so they appear here]."
        }\n\nThe purposes we process for are:\n\n${purposeLines}\n\nWe process strictly necessary data to provide the service you ask for. For everything else, our legal basis is your consent, which you give through our consent banner and can change at any time.`,
      },
      {
        heading: "Cookies and trackers",
        body: `We use cookies and similar technologies. Non-essential trackers stay blocked until you consent, and are released only for the purposes you allow:\n\n${trackerLines}\n\nYou can review and change these choices at any time from your privacy preferences.`,
      },
      {
        heading: "How long we keep your data",
        body: retentionLines
          ? `We keep personal data only as long as needed for the purpose it was collected for, then delete or anonymise it. Indicative periods:\n\n${retentionLines}\n\nWhen you withdraw consent, we stop the related processing and delete data we no longer have a lawful reason to keep.`
          : `We keep personal data only as long as needed for the purpose it was collected for, then delete or anonymise it. When you withdraw consent, we stop the related processing and delete data we no longer have a lawful reason to keep. [HUMAN: add specific retention periods per purpose].`,
      },
      {
        heading: "Your rights and how to use them",
        body: `Under DPDP you can ask us to: give you a summary of the personal data we hold about you and how we process it (access); correct or update inaccurate data; erase data we no longer need; and nominate someone to exercise your rights if you cannot. You can also withdraw consent at any time, as easily as you gave it. To make any of these requests, use the rights form on your privacy preferences page. We aim to respond within ${input.responseDays} days.`,
      },
      {
        heading: "Grievance redressal",
        body: `If you have a concern about how we handle your data, contact our Grievance Officer:\n\n${grievance}\n\n${dpo}`,
      },
      {
        heading: "Complaints to the Data Protection Board",
        body: `If we do not resolve your grievance to your satisfaction, you may complain to the Data Protection Board of India.`,
      },
      {
        heading: "Children's data",
        body: `We do not knowingly process the personal data of children (under 18) without verifiable parental consent, and we do not use children's data for tracking, behavioural monitoring, or targeted advertising. [HUMAN: confirm whether your service is directed at or used by children and adjust this section].`,
      },
      {
        heading: "Changes to this notice",
        body: `We may update this notice as our practices or the law change. When we make a material change, we will update the version shown on this page, and where required, ask for your consent again.`,
      },
    ],
  };
}
