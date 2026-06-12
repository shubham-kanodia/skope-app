/**
 * Deterministic JSON serialization for hashing. Two semantically-equal receipts
 * must produce byte-identical output, so:
 *   - object keys are sorted lexicographically (recursively),
 *   - no insignificant whitespace,
 *   - arrays keep their order (order is meaningful for purpose lists we sort
 *     upstream before hashing).
 * Undefined values are omitted; null is preserved.
 */
export function canonicalJson(value: unknown): string {
  return serialize(value);
}

function serialize(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Cannot canonicalize non-finite number");
    return JSON.stringify(value);
  }
  if (typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => serialize(v === undefined ? null : v)).join(",")}]`;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${serialize(obj[k])}`).join(",")}}`;
  }
  throw new Error(`Cannot canonicalize value of type ${typeof value}`);
}
