/**
 * Minimal RFC 4180 CSV building. Fields containing commas, quotes, or
 * newlines are quoted; quotes are doubled. Rows end with \r\n so Excel and
 * regulators' tooling open them cleanly.
 */
export function csvEscape(field: unknown): string {
  const s = field == null ? "" : String(field);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsvRow(fields: unknown[]): string {
  return fields.map(csvEscape).join(",") + "\r\n";
}
