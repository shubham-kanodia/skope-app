import { describe, it, expect } from "vitest";
import { resolveConsent } from "./state";
import type { Purpose } from "./types";

const purposes: Purpose[] = [
  { key: "necessary", isEssential: true },
  { key: "analytics", isEssential: false },
  { key: "marketing", isEssential: false },
];

describe("resolveConsent", () => {
  it("grant accepts everything", () => {
    expect(resolveConsent({ action: "grant", purposes })).toEqual({
      granted: ["analytics", "marketing", "necessary"],
      denied: [],
    });
  });

  it("deny keeps only essential", () => {
    expect(resolveConsent({ action: "deny", purposes })).toEqual({
      granted: ["necessary"],
      denied: ["analytics", "marketing"],
    });
  });

  it("withdraw_all behaves like deny", () => {
    expect(resolveConsent({ action: "withdraw_all", purposes })).toEqual({
      granted: ["necessary"],
      denied: ["analytics", "marketing"],
    });
  });

  it("update honors the selected non-essential set", () => {
    expect(resolveConsent({ action: "update", purposes, selected: ["analytics"] })).toEqual({
      granted: ["analytics", "necessary"],
      denied: ["marketing"],
    });
  });

  it("withdraw uses the same selection logic", () => {
    expect(resolveConsent({ action: "withdraw", purposes, selected: [] })).toEqual({
      granted: ["necessary"],
      denied: ["analytics", "marketing"],
    });
  });

  it("never denies an essential purpose even if not selected", () => {
    const res = resolveConsent({ action: "update", purposes, selected: ["necessary"] });
    expect(res.granted).toContain("necessary");
    expect(res.denied).not.toContain("necessary");
  });

  it("ignores unknown selected keys", () => {
    const res = resolveConsent({ action: "update", purposes, selected: ["ghost", "analytics"] });
    expect(res.granted).toEqual(["analytics", "necessary"]);
  });

  it("dedupes and sorts output", () => {
    const dupes: Purpose[] = [
      { key: "a", isEssential: false },
      { key: "a", isEssential: false },
      { key: "b", isEssential: true },
    ];
    const res = resolveConsent({ action: "grant", purposes: dupes });
    expect(res.granted).toEqual(["a", "b"]);
  });

  it("throws on an unknown action", () => {
    // @ts-expect-error testing runtime guard
    expect(() => resolveConsent({ action: "explode", purposes })).toThrow();
  });
});
