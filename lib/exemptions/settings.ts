/**
 * Recorded processing exemptions a fiduciary relies on (DPDP §17 general
 * exemptions; §9(4)/(5) children's-data exemptions). Stored per-site in
 * sites.settings.exemptions (jsonb). This is a documentation/audit surface,  * the customer records the grounds they rely on so it's evidenced in the audit
 * bundle. [HUMAN] Whether an exemption applies is fact- and Rules-specific;
 * counsel should confirm.
 */
export interface ExemptionSettings {
  /** §17 grounds relied on (free text). */
  section17: string;
  /** §9(4)/(5) children's-data exemption grounds (free text). */
  section9: string;
}

export const DEFAULT_EXEMPTION_SETTINGS: ExemptionSettings = { section17: "", section9: "" };

export function mergeExemptionSettings(raw: unknown): ExemptionSettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_EXEMPTION_SETTINGS };
  const r = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 1000) : "");
  return { section17: str(r.section17), section9: str(r.section9) };
}

export function exemptionsFromSettings(settings: Record<string, unknown>): ExemptionSettings {
  return mergeExemptionSettings((settings as { exemptions?: unknown }).exemptions);
}
