/** Shared types for the consent engine. Pure data, no DB, no runtime deps. */

export type ConsentAction =
  | "grant"
  | "deny"
  | "update"
  | "withdraw"
  | "withdraw_all"
  // Parental/guardian consent for a child's data (DPDP §9), recorded as a
  // distinct ledger action. Written only by the parental-consent flow, never
  // accepted on the public banner consent endpoint.
  | "parental_grant"
  | "parental_withdraw";
export type ConsentMethod = "banner" | "preference_center" | "form" | "api";
export type GeoMode = "india_only" | "global" | "custom";

/** A purpose as the engine needs to reason about it. */
export interface Purpose {
  key: string;
  /** Essential purposes are always granted and cannot be toggled off. */
  isEssential: boolean;
}

/** The decision a visitor made, normalized into granted/denied key sets. */
export interface ConsentState {
  granted: string[];
  denied: string[];
}

/** The immutable, hashable core of a consent receipt (chain input). */
export interface ReceiptCore {
  siteId: string;
  subjectId: string;
  action: ConsentAction;
  purposesGranted: string[];
  purposesDenied: string[];
  noticeVersion: number | null;
  languageShown: string | null;
  region: string | null;
  method: ConsentMethod;
  formId: string | null;
  occurredAt: string; // ISO 8601 UTC
  seq: number; // per-site monotonic position
  /**
   * Checksum of the exact published notice shown at consent time (DPDP §6(10)).
   * Optional and bound into the hash ONLY when present, so historical receipts
   * (which predate this field) hash identically and the chain still verifies.
   */
  noticeChecksum?: string | null;
}

export type NonTargetBehavior = "allow_all" | "block_marketing";

export interface GeoDecision {
  /** Two-letter country used for the receipt's `region`. */
  region: string;
  /** Whether to show the consent banner to this visitor. */
  showBanner: boolean;
  /** What to do with trackers when the banner is NOT shown. */
  nonTargetBehavior: NonTargetBehavior;
}
