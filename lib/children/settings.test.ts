import { describe, expect, it } from "vitest";
import { mergeChildrenSettings, childrenFromSettings, DEFAULT_CHILDREN_SETTINGS } from "./settings";

describe("mergeChildrenSettings", () => {
  it("defaults on junk", () => {
    expect(mergeChildrenSettings(null)).toEqual(DEFAULT_CHILDREN_SETTINGS);
    expect(mergeChildrenSettings("x")).toEqual(DEFAULT_CHILDREN_SETTINGS);
  });

  it("only accepts the known child mode", () => {
    expect(mergeChildrenSettings({ childMode: "age_gate" }).childMode).toBe("age_gate");
    expect(mergeChildrenSettings({ childMode: "weird" }).childMode).toBe("off");
  });

  it("coerces directedAtChildren to a strict boolean", () => {
    expect(mergeChildrenSettings({ directedAtChildren: true }).directedAtChildren).toBe(true);
    expect(mergeChildrenSettings({ directedAtChildren: "yes" }).directedAtChildren).toBe(false);
  });

  it("trims and bounds the exempt class, empty → null", () => {
    expect(mergeChildrenSettings({ exemptClass: "   " }).exemptClass).toBeNull();
    expect(mergeChildrenSettings({ exemptClass: "  clause 9(4)  " }).exemptClass).toBe("clause 9(4)");
    expect(mergeChildrenSettings({ exemptClass: "a".repeat(500) }).exemptClass?.length).toBe(200);
  });

  it("reads from a site settings blob", () => {
    expect(childrenFromSettings({ children: { childMode: "age_gate" } }).childMode).toBe("age_gate");
    expect(childrenFromSettings({}).childMode).toBe("off");
  });
});
