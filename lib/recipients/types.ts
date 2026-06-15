/**
 * Recipients / Data Processor register (DPDP §5, §8(2), §11(1)(b)). Pure types +
 * coercion, clamped at the action boundary like coerceDataItems.
 */
export const RECIPIENT_ROLES = ["fiduciary", "processor"] as const;
export type RecipientRole = (typeof RECIPIENT_ROLES)[number];

export const ROLE_LABELS: Record<RecipientRole, string> = {
  fiduciary: "Other Data Fiduciary",
  processor: "Data Processor",
};

export const CONTRACT_STATUSES = ["signed", "pending", "none"] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

/** A stored recipient. */
export interface Recipient {
  id: string;
  name: string;
  role: RecipientRole;
  purpose: string | null;
  dataItemKeys: string[];
  country: string | null;
  contractRef: string | null;
  contractStatus: ContractStatus | null;
  webhookUrl: string | null;
  position: number;
}

/** A recipient as submitted by the editor (no id). */
export interface RecipientInput {
  name: string;
  role: RecipientRole;
  purpose: string | null;
  dataItemKeys: string[];
  country: string | null;
  contractRef: string | null;
  contractStatus: ContractStatus | null;
  webhookUrl: string | null;
}

const MAX_RECIPIENTS = 60;

function cleanUrl(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const s = v.trim().slice(0, 400);
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? s : null;
  } catch {
    return null;
  }
}

/** Clamp an untrusted editor payload into a valid recipient list, or null. */
export function coerceRecipients(raw: unknown): RecipientInput[] | null {
  if (!Array.isArray(raw)) return null;
  const out: RecipientInput[] = [];

  for (const v of raw.slice(0, MAX_RECIPIENTS * 2)) {
    if (!v || typeof v !== "object") continue;
    const r = v as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name.trim().slice(0, 160) : "";
    if (!name) continue;

    const role: RecipientRole = RECIPIENT_ROLES.includes(r.role as RecipientRole)
      ? (r.role as RecipientRole)
      : "processor";
    const purpose = typeof r.purpose === "string" && r.purpose.trim() ? r.purpose.trim().slice(0, 200) : null;
    const dataItemKeys = Array.isArray(r.dataItemKeys)
      ? r.dataItemKeys
          .filter((k): k is string => typeof k === "string")
          .map((k) => k.trim().slice(0, 52))
          .filter(Boolean)
          .slice(0, 40)
      : [];
    const country =
      typeof r.country === "string" && /^[a-zA-Z]{2}$/.test(r.country.trim())
        ? r.country.trim().toUpperCase()
        : null;
    const contractRef =
      typeof r.contractRef === "string" && r.contractRef.trim() ? r.contractRef.trim().slice(0, 200) : null;
    const contractStatus = CONTRACT_STATUSES.includes(r.contractStatus as ContractStatus)
      ? (r.contractStatus as ContractStatus)
      : null;
    const webhookUrl = cleanUrl(r.webhookUrl);

    out.push({ name, role, purpose, dataItemKeys, country, contractRef, contractStatus, webhookUrl });
    if (out.length >= MAX_RECIPIENTS) break;
  }
  return out;
}
