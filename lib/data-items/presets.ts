import type { DataItemCategory } from "./types";

/**
 * One-click presets for the editor, the items Indian sites most commonly
 * collect. Official IDs carry helper text because they warrant extra care
 * under DPDP (collect only when a law or the stated purpose truly needs them).
 */
export interface DataItemPreset {
  key: string;
  name: string;
  category: DataItemCategory;
  purposeKey: string;
  hint?: string;
}

export const DATA_ITEM_PRESETS: DataItemPreset[] = [
  { key: "name", name: "Full name", category: "identity", purposeKey: "necessary" },
  { key: "email", name: "Email address", category: "contact", purposeKey: "necessary" },
  { key: "phone", name: "Phone number", category: "contact", purposeKey: "necessary" },
  { key: "address", name: "Postal address", category: "contact", purposeKey: "necessary" },
  { key: "dob", name: "Date of birth", category: "identity", purposeKey: "necessary" },
  {
    key: "pan",
    name: "PAN",
    category: "official_id",
    purposeKey: "necessary",
    hint: "Collect official IDs only when a law or the stated purpose truly needs them.",
  },
  {
    key: "aadhaar",
    name: "Aadhaar number",
    category: "official_id",
    purposeKey: "necessary",
    hint: "Aadhaar collection is restricted by law. Confirm you're permitted to collect it.",
  },
  { key: "payment-details", name: "Payment details", category: "financial", purposeKey: "necessary" },
  { key: "order-history", name: "Order history", category: "usage", purposeKey: "analytics" },
  { key: "device-data", name: "Device and usage data", category: "usage", purposeKey: "analytics" },
];
