import { describe, it, expect } from "vitest";
import { canonicalJson } from "./canonical";

describe("canonicalJson", () => {
  it("sorts object keys recursively and is order-independent", () => {
    const a = canonicalJson({ b: 1, a: { d: 4, c: 3 } });
    const b = canonicalJson({ a: { c: 3, d: 4 }, b: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":{"c":3,"d":4},"b":1}');
  });

  it("preserves array order", () => {
    expect(canonicalJson(["b", "a"])).toBe('["b","a"]');
  });

  it("preserves null but omits undefined object values", () => {
    expect(canonicalJson({ a: null, b: undefined, c: 1 })).toBe('{"a":null,"c":1}');
  });

  it("maps undefined array entries to null", () => {
    expect(canonicalJson([undefined, 1])).toBe("[null,1]");
  });

  it("serializes primitives", () => {
    expect(canonicalJson("x")).toBe('"x"');
    expect(canonicalJson(true)).toBe("true");
    expect(canonicalJson(5)).toBe("5");
    expect(canonicalJson(null)).toBe("null");
  });

  it("throws on non-finite numbers", () => {
    expect(() => canonicalJson(Number.POSITIVE_INFINITY)).toThrow();
    expect(() => canonicalJson(NaN)).toThrow();
  });

  it("throws on unsupported types", () => {
    expect(() => canonicalJson(() => 0)).toThrow();
    expect(() => canonicalJson(BigInt(1))).toThrow();
  });
});
