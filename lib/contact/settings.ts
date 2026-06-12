/**
 * Grievance Officer + DPO contact, persisted per-site in sites.settings.contact
 * (jsonb), alongside the banner settings. DPDP §13 requires a readily-available
 * grievance redress contact; §5/§8(9) requires the business contact of a person
 * (a DPO for Significant Data Fiduciaries) who can answer rights questions.
 *
 * This contact feeds the AI privacy-policy generator, is shown on the hosted
 * privacy + preferences pages, and sets the default response window for rights
 * requests. The published contact is what visitors use to reach the fiduciary.
 */
export interface ContactSettings {
  /** Legal/organisation name of the Data Fiduciary, shown as "We are ..." in the notice. */
  entityName: string;
  /** Grievance officer (required to be DPDP-complete). */
  grievanceName: string;
  grievanceEmail: string;
  grievancePhone: string;
  grievanceAddress: string;
  /** Data Protection Officer / person who can answer rights questions (optional). */
  dpoName: string;
  dpoEmail: string;
  /**
   * Days within which the fiduciary commits to respond to a rights request.
   * Sets request.due_at. [HUMAN] Confirm the statutory/published window with
   * counsel before launch (DPDP Rules tie this to the fiduciary's own notice).
   */
  responseDays: number;
}

export const DEFAULT_CONTACT_SETTINGS: ContactSettings = {
  entityName: "",
  grievanceName: "",
  grievanceEmail: "",
  grievancePhone: "",
  grievanceAddress: "",
  dpoName: "",
  dpoEmail: "",
  responseDays: 30,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A contact is "DPDP-complete" once a grievance officer name + email exist. */
export function hasGrievanceContact(c: ContactSettings): boolean {
  return c.grievanceName.trim().length > 0 && EMAIL_RE.test(c.grievanceEmail);
}

export function isValidEmail(v: string): boolean {
  return EMAIL_RE.test(v);
}

/** Merge stored (untrusted) contact over defaults, clamping every field. */
export function mergeContactSettings(raw: unknown): ContactSettings {
  const d = DEFAULT_CONTACT_SETTINGS;
  if (!raw || typeof raw !== "object") return { ...d };
  const r = raw as Record<string, unknown>;
  const str = (v: unknown, fallback: string, max: number) =>
    typeof v === "string" ? v.trim().slice(0, max) : fallback;

  const responseDays =
    typeof r.responseDays === "number" && Number.isFinite(r.responseDays)
      ? Math.min(180, Math.max(1, Math.round(r.responseDays)))
      : d.responseDays;

  return {
    entityName: str(r.entityName, d.entityName, 160),
    grievanceName: str(r.grievanceName, d.grievanceName, 120),
    grievanceEmail: str(r.grievanceEmail, d.grievanceEmail, 160),
    grievancePhone: str(r.grievancePhone, d.grievancePhone, 40),
    grievanceAddress: str(r.grievanceAddress, d.grievanceAddress, 400),
    dpoName: str(r.dpoName, d.dpoName, 120),
    dpoEmail: str(r.dpoEmail, d.dpoEmail, 160),
    responseDays,
  };
}

/** Read the contact block out of a site's settings jsonb. */
export function contactFromSettings(settings: Record<string, unknown>): ContactSettings {
  return mergeContactSettings((settings as { contact?: unknown }).contact);
}
