import type { ConsentAction, ConsentState, Purpose } from "./types";

/**
 * Resolve a consent decision into explicit granted/denied purpose sets.
 *
 * Rules (DPDP + no-dark-patterns):
 *   - Essential purposes are ALWAYS granted and never appear in `denied`.
 *   - `grant`  (Accept all):            every purpose granted.
 *   - `deny` / `withdraw_all`:          essential only; everything else denied.
 *   - `update` / `withdraw` (Manage):   `selected` lists the non-essential
 *                                       purposes the visitor keeps on; the rest
 *                                       are denied.
 *
 * Stateless: the same inputs always yield the same output (important, receipts
 * are reproducible). Unknown keys in `selected` are ignored.
 */
export function resolveConsent(params: {
  action: ConsentAction;
  purposes: Purpose[];
  selected?: string[];
}): ConsentState {
  const { action, purposes } = params;
  const essential = purposes.filter((p) => p.isEssential).map((p) => p.key);
  const nonEssential = purposes.filter((p) => !p.isEssential).map((p) => p.key);
  const allKeys = new Set(purposes.map((p) => p.key));
  const selected = (params.selected ?? []).filter((k) => allKeys.has(k));

  let granted: string[];
  let denied: string[];

  switch (action) {
    case "grant":
      granted = [...essential, ...nonEssential];
      denied = [];
      break;
    case "deny":
    case "withdraw_all":
      granted = [...essential];
      denied = [...nonEssential];
      break;
    case "update":
    case "withdraw": {
      const keep = new Set(selected.filter((k) => nonEssential.includes(k)));
      granted = [...essential, ...nonEssential.filter((k) => keep.has(k))];
      denied = nonEssential.filter((k) => !keep.has(k));
      break;
    }
    default:
      throw new Error(`Unknown consent action: ${action as string}`);
  }

  return { granted: dedupeSort(granted), denied: dedupeSort(denied) };
}

function dedupeSort(keys: string[]): string[] {
  return [...new Set(keys)].sort();
}
