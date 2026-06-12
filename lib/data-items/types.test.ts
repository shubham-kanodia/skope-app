import { describe, expect, it } from "vitest";
import { coerceDataItems, slugifyKey } from "./types";

describe("slugifyKey", () => {
  it("lowercases and dashes", () => {
    expect(slugifyKey("Email address")).toBe("email-address");
    expect(slugifyKey("  PAN!! ")).toBe("pan");
  });

  it("never returns empty", () => {
    expect(slugifyKey("!!!")).toBe("item");
  });

  it("bounds length", () => {
    expect(slugifyKey("a".repeat(100)).length).toBeLessThanOrEqual(48);
  });
});

describe("coerceDataItems", () => {
  it("rejects non-arrays", () => {
    expect(coerceDataItems(null)).toBeNull();
    expect(coerceDataItems({})).toBeNull();
    expect(coerceDataItems("x")).toBeNull();
  });

  it("keeps valid items and derives keys from names", () => {
    const out = coerceDataItems([
      { name: "Email address", category: "contact", purposeKey: "necessary" },
    ]);
    expect(out).toEqual([
      {
        key: "email-address",
        name: "Email address",
        category: "contact",
        purposeKey: "necessary",
        sourceLabel: null,
        retentionDays: null,
      },
    ]);
  });

  it("drops nameless rows and clamps long names", () => {
    const out = coerceDataItems([
      { name: "" },
      { name: "   " },
      { name: "x".repeat(200), category: "other" },
    ]);
    expect(out).toHaveLength(1);
    expect(out![0].name).toHaveLength(80);
  });

  it("whitelists category and purpose key", () => {
    const out = coerceDataItems([
      { name: "Thing", category: "nonsense", purposeKey: "evil" },
    ]);
    expect(out![0].category).toBe("other");
    expect(out![0].purposeKey).toBe("necessary");
  });

  it("dedupes keys deterministically", () => {
    const out = coerceDataItems([{ name: "Email" }, { name: "email" }, { name: "Email" }]);
    expect(out!.map((i) => i.key)).toEqual(["email", "email-2", "email-3"]);
  });

  it("caps the list at 40 items", () => {
    const raw = Array.from({ length: 60 }, (_, i) => ({ name: `Item ${i}` }));
    expect(coerceDataItems(raw)).toHaveLength(40);
  });

  it("clamps retention to positive integers", () => {
    const out = coerceDataItems([
      { name: "A", retentionDays: 365 },
      { name: "B", retentionDays: -5 },
      { name: "C", retentionDays: "soon" },
      { name: "D", retentionDays: 1.5 },
    ]);
    expect(out!.map((i) => i.retentionDays)).toEqual([365, null, null, null]);
  });
});
