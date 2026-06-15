/**
 * Personal data breach incidents (DPDP §8(6)). The customer records an incident,
 * tracks remediation, and marks when the Data Protection Board and affected
 * Data Principals were notified. Stored unencrypted, these are the fiduciary's
 * own operational notes about an incident, not principals' personal data (like
 * a request's resolution note).
 */
export type BreachStatus =
  | "open"
  | "contained"
  | "board_notified"
  | "principals_notified"
  | "closed";

export const BREACH_STATUSES: BreachStatus[] = [
  "open",
  "contained",
  "board_notified",
  "principals_notified",
  "closed",
];

export const BREACH_STATUS_LABELS: Record<BreachStatus, string> = {
  open: "Open",
  contained: "Contained",
  board_notified: "Board notified",
  principals_notified: "People notified",
  closed: "Closed",
};

/** Common categories, offered as quick-picks; the field is free-form text[]. */
export const BREACH_DATA_CATEGORIES = [
  "Identity (name, ID)",
  "Contact (email, phone, address)",
  "Financial (cards, bank, payments)",
  "Official identifiers (PAN, Aadhaar)",
  "Account credentials",
  "Usage / behavioural",
  "Children's data",
  "Health",
  "Other",
];

export interface BreachInput {
  detectedAt: string; // ISO date/time
  nature: string;
  dataCategories: string[];
  estAffected: number | null;
  remediation: string;
}

export interface BreachNotification {
  id: string;
  audience: "board" | "principals";
  channel: string;
  recipientCount: number | null;
  subject: string;
  body: string;
  sentAt: string;
}

export interface BreachRow {
  id: string;
  siteId: string | null;
  domain: string | null;
  detectedAt: string;
  nature: string;
  dataCategories: string[];
  estAffected: number | null;
  remediation: string;
  status: BreachStatus;
  boardNotifiedAt: string | null;
  principalsNotifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Coerce an untrusted intake payload into a clean BreachInput, or null. */
export function coerceBreachInput(raw: unknown): BreachInput | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const nature = typeof r.nature === "string" ? r.nature.trim().slice(0, 4000) : "";
  if (nature.length === 0) return null;

  const detectedRaw = typeof r.detectedAt === "string" ? r.detectedAt : "";
  const detected = detectedRaw ? new Date(detectedRaw) : new Date(NaN);
  if (Number.isNaN(detected.getTime())) return null;

  const dataCategories = Array.isArray(r.dataCategories)
    ? r.dataCategories
        .filter((c): c is string => typeof c === "string")
        .map((c) => c.trim().slice(0, 120))
        .filter(Boolean)
        .slice(0, 30)
    : [];

  const estAffected =
    typeof r.estAffected === "number" && Number.isFinite(r.estAffected) && r.estAffected >= 0
      ? Math.min(1_000_000_000, Math.round(r.estAffected))
      : null;

  const remediation = typeof r.remediation === "string" ? r.remediation.trim().slice(0, 4000) : "";

  return { detectedAt: detected.toISOString(), nature, dataCategories, estAffected, remediation };
}
