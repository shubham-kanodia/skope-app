/**
 * Cross-border transfer restriction (DPDP §16(1)): the Central Government may, by
 * notification, restrict transfer of personal data to certain countries. No such
 * list has been notified yet, so this starts empty. When the Government notifies
 * a list, add the ISO-3166 alpha-2 codes here (one-line update) and the
 * recipients editor will warn on any matching destination.
 *
 * [HUMAN] Keep this in sync with the official notification.
 */
export const RESTRICTED_COUNTRIES: ReadonlySet<string> = new Set<string>([
  // e.g. "XX", populate once notified.
]);

export function isRestrictedCountry(code: string | null | undefined): boolean {
  return code ? RESTRICTED_COUNTRIES.has(code.toUpperCase()) : false;
}
