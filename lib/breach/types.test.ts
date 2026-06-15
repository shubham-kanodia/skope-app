import { describe, expect, it } from "vitest";
import { coerceBreachInput } from "./types";

describe("coerceBreachInput", () => {
  const base = {
    detectedAt: "2026-06-01T10:00:00.000Z",
    nature: "Storage bucket exposed contact records.",
    dataCategories: ["Contact (email, phone, address)"],
    estAffected: 1200,
    remediation: "Closed the bucket, rotated keys.",
  };

  it("rejects non-objects", () => {
    expect(coerceBreachInput(null)).toBeNull();
    expect(coerceBreachInput("x")).toBeNull();
  });

  it("requires a nature", () => {
    expect(coerceBreachInput({ ...base, nature: "   " })).toBeNull();
  });

  it("requires a valid detection time", () => {
    expect(coerceBreachInput({ ...base, detectedAt: "not-a-date" })).toBeNull();
    expect(coerceBreachInput({ ...base, detectedAt: "" })).toBeNull();
  });

  it("normalises a clean payload", () => {
    const out = coerceBreachInput(base);
    expect(out).not.toBeNull();
    expect(out!.detectedAt).toBe("2026-06-01T10:00:00.000Z");
    expect(out!.estAffected).toBe(1200);
    expect(out!.dataCategories).toEqual(["Contact (email, phone, address)"]);
  });

  it("coerces a missing / negative count to null", () => {
    expect(coerceBreachInput({ ...base, estAffected: undefined })!.estAffected).toBeNull();
    expect(coerceBreachInput({ ...base, estAffected: -5 })!.estAffected).toBeNull();
  });

  it("drops non-string categories and bounds the list", () => {
    const out = coerceBreachInput({ ...base, dataCategories: ["Contact", 7, "", "Health"] });
    expect(out!.dataCategories).toEqual(["Contact", "Health"]);
  });

  it("rounds a fractional count", () => {
    expect(coerceBreachInput({ ...base, estAffected: 12.7 })!.estAffected).toBe(13);
  });
});
