/**
 * Children's-data settings, persisted per-site in sites.settings.children (jsonb).
 *
 * DPDP §9: a Data Fiduciary must obtain verifiable parental/guardian consent
 * before processing a child's (under-18) personal data (§9(1)), must not process
 * in a way detrimental to a child (§9(2)), and must not track, behaviourally
 * monitor, or target ads at children (§9(3)). §9(4)/(5) let the Government exempt
 * classes of fiduciary or purposes.
 *
 * When childMode is "age_gate", the banner asks for an age signal before consent;
 * a visitor who is a child gets "child mode", all non-essential trackers stay
 * blocked and marketing/analytics are off regardless of the UI, and is routed
 * to verifiable parental-consent capture before any non-essential processing.
 */
export type ChildMode = "off" | "age_gate";

export interface ChildrenSettings {
  /** Is this service directed at, or likely used by, children? */
  directedAtChildren: boolean;
  /** "off" = no age step; "age_gate" = ask an age signal and enforce child mode. */
  childMode: ChildMode;
  /** §9(4)/(5) exempt class the fiduciary relies on, if any (free text, recorded for audit). */
  exemptClass: string | null;
}

export const DEFAULT_CHILDREN_SETTINGS: ChildrenSettings = {
  directedAtChildren: false,
  childMode: "off",
  exemptClass: null,
};

export function mergeChildrenSettings(raw: unknown): ChildrenSettings {
  const d = DEFAULT_CHILDREN_SETTINGS;
  if (!raw || typeof raw !== "object") return { ...d };
  const r = raw as Record<string, unknown>;
  const childMode: ChildMode = r.childMode === "age_gate" ? "age_gate" : "off";
  const exemptClass =
    typeof r.exemptClass === "string" && r.exemptClass.trim().length > 0
      ? r.exemptClass.trim().slice(0, 200)
      : null;
  return {
    directedAtChildren: r.directedAtChildren === true,
    childMode,
    exemptClass,
  };
}

export function childrenFromSettings(settings: Record<string, unknown>): ChildrenSettings {
  return mergeChildrenSettings((settings as { children?: unknown }).children);
}
