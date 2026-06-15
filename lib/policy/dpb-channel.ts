/**
 * How a Data Principal may complain to the Data Protection Board of India
 * (DPDP §5(1)(iii), the notice must state the manner of complaining to the
 * Board). The Board's digital office / official channel is being stood up under
 * the DPDP Rules; this is the single place to update the concrete mechanism so
 * every generated notice stays current with one edit.
 *
 * [HUMAN] Update the URL/desk details here when the Board notifies its mechanism.
 */
export const DPB_COMPLAINT_CHANNEL = {
  // Replace with the Board's official complaint portal once notified.
  url: "https://www.meity.gov.in/data-protection-board",
  text:
    "If we do not resolve your grievance to your satisfaction, or do not respond within the period " +
    "required by law, you may complain to the Data Protection Board of India. The Board operates as " +
    "a digital office; complaints are made through its official channel notified under the DPDP Rules " +
    "(see the Ministry of Electronics and Information Technology's site for the current mechanism).",
};

/** The notice section body for complaining to the Board. */
export function dpbComplaintBody(): string {
  return `${DPB_COMPLAINT_CHANNEL.text}\n\nBoard information: ${DPB_COMPLAINT_CHANNEL.url}`;
}
