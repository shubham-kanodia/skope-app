import { describe, expect, it } from "vitest";
import {
  mergeRetentionSettings,
  retentionFromSettings,
  windowForPurpose,
  DEFAULT_RETENTION_SETTINGS,
} from "./settings";

describe("mergeRetentionSettings", () => {
  it("falls back to the default on junk", () => {
    expect(mergeRetentionSettings(null).inactivityDays).toBe(DEFAULT_RETENTION_SETTINGS.inactivityDays);
    expect(mergeRetentionSettings("x").perPurpose).toEqual({});
  });

  it("clamps the window to sane bounds", () => {
    expect(mergeRetentionSettings({ inactivityDays: 0 }).inactivityDays).toBe(1);
    expect(mergeRetentionSettings({ inactivityDays: 10_000_000 }).inactivityDays).toBe(36_500);
    expect(mergeRetentionSettings({ inactivityDays: 365.6 }).inactivityDays).toBe(366);
  });

  it("keeps only numeric per-purpose overrides", () => {
    const out = mergeRetentionSettings({
      inactivityDays: 800,
      perPurpose: { analytics: 200, marketing: "nope", junk: 5 },
    });
    expect(out.perPurpose).toEqual({ analytics: 200, junk: 5 });
  });
});

describe("windowForPurpose", () => {
  it("uses the override when present, else the default", () => {
    const s = retentionFromSettings({ retention: { inactivityDays: 700, perPurpose: { marketing: 90 } } });
    expect(windowForPurpose(s, "marketing")).toBe(90);
    expect(windowForPurpose(s, "analytics")).toBe(700);
  });
});
