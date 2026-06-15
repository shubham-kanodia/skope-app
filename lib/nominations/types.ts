/**
 * Pure types + labels for nominations, no DB import, so the nominations client
 * UI can use them without bundling the Postgres client. The store re-exports.
 */
export type NominationStatus = "recorded" | "activated" | "revoked";

export const NOMINATION_STATUS_LABELS: Record<NominationStatus, string> = {
  recorded: "Recorded",
  activated: "Activated",
  revoked: "Revoked",
};

export interface NominationRow {
  id: string;
  siteId: string;
  domain: string;
  principalRef: string | null;
  nomineeName: string | null;
  nomineeContact: string | null;
  relationship: string | null;
  status: NominationStatus;
  activatedAt: string | null;
  createdAt: string;
}
