import { describe, expect, it } from "vitest";
import {
  arePaymentsPaused,
  getEntitlement,
  isLaunchOfferOpen,
  LAUNCH_OFFER_SIGNUP_DEADLINE,
  newOrgEntitlement,
  PAYMENTS_PAUSED_UNTIL,
} from "./index";

const DURING_OFFER = new Date("2026-06-20T10:00:00+05:30");
const AFTER_OFFER = new Date("2026-07-20T10:00:00+05:30");
const AFTER_PAUSE = new Date("2026-09-01T10:00:00+05:30");

describe("launch offer windows", () => {
  it("offer is open until the signup deadline", () => {
    expect(isLaunchOfferOpen(DURING_OFFER)).toBe(true);
    expect(isLaunchOfferOpen(LAUNCH_OFFER_SIGNUP_DEADLINE)).toBe(true);
    expect(isLaunchOfferOpen(AFTER_OFFER)).toBe(false);
  });

  it("payments stay paused until the pause date", () => {
    expect(arePaymentsPaused(DURING_OFFER)).toBe(true);
    expect(arePaymentsPaused(AFTER_OFFER)).toBe(true); // offer closed, still no payments
    expect(arePaymentsPaused(PAYMENTS_PAUSED_UNTIL)).toBe(false);
    expect(arePaymentsPaused(AFTER_PAUSE)).toBe(false);
  });
});

describe("newOrgEntitlement", () => {
  it("grants 6 months comp inside the window, never founding flags", () => {
    const ent = newOrgEntitlement(1, DURING_OFFER);
    expect(ent.is_founding_member).toBe(false);
    expect(ent.founding_number).toBeNull();
    expect(ent.comp_until).toEqual(new Date("2026-12-20T10:00:00+05:30"));
  });

  it("grants only the trial after the window", () => {
    const ent = newOrgEntitlement(1, AFTER_OFFER);
    expect(ent.comp_until).toBeNull();
    expect(ent.is_founding_member).toBe(false);
    expect(ent.trial_ends_at.getTime()).toBeGreaterThan(AFTER_OFFER.getTime());
  });
});

describe("getEntitlement", () => {
  const base = {
    plan: "free" as const,
    trial_ends_at: new Date("2026-07-20"),
    is_founding_member: false,
    founding_number: null,
    comp_until: null as Date | null,
  };

  it("launch-offer orgs get growth-tier 'launch' status with no upgrade nudge", () => {
    const ent = getEntitlement({ ...base, comp_until: new Date("2026-12-20") }, DURING_OFFER);
    expect(ent.status).toBe("launch");
    expect(ent.tier).toBe("growth");
    expect(ent.unlocked).toBe(true);
    expect(ent.banner).toContain("free for early members until");
  });

  it("legacy founding members keep their status", () => {
    const ent = getEntitlement(
      { ...base, is_founding_member: true, founding_number: 7, comp_until: new Date("2028-06-12") },
      DURING_OFFER,
    );
    expect(ent.status).toBe("founding");
    expect(ent.banner).toContain("Founding member #7");
  });

  it("expired comp falls back to trial, then free", () => {
    const expired = { ...base, comp_until: new Date("2026-12-20") };
    const inTrial = getEntitlement({ ...expired, trial_ends_at: new Date("2027-01-15") }, new Date("2027-01-01"));
    expect(inTrial.status).toBe("trial");
    const done = getEntitlement(expired, new Date("2027-08-01"));
    expect(done.status).toBe("free");
    expect(done.unlocked).toBe(false);
  });
});
