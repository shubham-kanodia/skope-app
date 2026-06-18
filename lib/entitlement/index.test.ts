import { describe, expect, it } from "vitest";
import { getEntitlement, newOrgEntitlement } from "./index";

describe("newOrgEntitlement", () => {
  it("creates a read-only org: no comp, no founding, lapsed plan window", () => {
    const ent = newOrgEntitlement(1);
    expect(ent.is_founding_member).toBe(false);
    expect(ent.founding_number).toBeNull();
    expect(ent.comp_until).toBeNull();
    // plan_active_until in the past → getEntitlement returns "inactive".
    expect(ent.plan_active_until.getTime()).toBeLessThan(Date.now());
  });
});

describe("getEntitlement", () => {
  const base = {
    plan: "starter" as const,
    is_founding_member: false,
    founding_number: null,
    comp_until: null as Date | null,
    plan_active_until: null as Date | null,
  };

  it("an active paid subscription unlocks its tier", () => {
    const ent = getEntitlement(
      { ...base, plan: "growth", plan_active_until: new Date("2027-01-01") },
      new Date("2026-12-01"),
    );
    expect(ent.status).toBe("paid");
    expect(ent.tier).toBe("growth");
    expect(ent.unlocked).toBe(true);
    expect(ent.banner).toBe("");
  });

  it("a null active window is treated as an open-ended (manual) grant", () => {
    const ent = getEntitlement({ ...base, plan_active_until: null });
    expect(ent.status).toBe("paid");
    expect(ent.unlocked).toBe(true);
  });

  it("a lapsed subscription is read-only ('inactive'), banner still nudges", () => {
    const ent = getEntitlement(
      { ...base, plan_active_until: new Date("2026-01-01") },
      new Date("2026-12-01"),
    );
    expect(ent.status).toBe("inactive");
    expect(ent.unlocked).toBe(false);
    expect(ent.tier).toBe("starter");
    expect(ent.banner).toContain("Subscribe");
  });

  it("legacy founding members keep their comp status", () => {
    const ent = getEntitlement(
      { ...base, is_founding_member: true, founding_number: 7, comp_until: new Date("2028-06-12") },
      new Date("2026-12-01"),
    );
    expect(ent.status).toBe("founding");
    expect(ent.tier).toBe("growth");
    expect(ent.banner).toContain("Founding member #7");
  });

  it("expired founding comp falls through to inactive", () => {
    const ent = getEntitlement(
      { ...base, is_founding_member: true, comp_until: new Date("2026-01-01"), plan_active_until: new Date("2026-01-01") },
      new Date("2026-12-01"),
    );
    expect(ent.status).toBe("inactive");
    expect(ent.unlocked).toBe(false);
  });
});
