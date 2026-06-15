/** Pure helpers for the retrospective-notice list, no DB, so unit-testable. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MAX_RETRO_RECIPIENTS = 50_000;

/** Parse a pasted/uploaded list (newlines or commas) into unique valid emails. */
export function parseEmailList(raw: string): string[] {
  const seen = new Set<string>();
  for (const part of raw.split(/[\s,;]+/)) {
    const e = part.trim().toLowerCase();
    if (EMAIL_RE.test(e) && e.length <= 160) seen.add(e);
    if (seen.size >= MAX_RETRO_RECIPIENTS) break;
  }
  return [...seen];
}
