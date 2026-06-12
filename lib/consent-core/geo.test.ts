import { describe, it, expect } from "vitest";
import { decideGeo } from "./geo";

describe("decideGeo", () => {
  it("india_only shows the banner for India only", () => {
    expect(decideGeo({ country: "IN", geoMode: "india_only" }).showBanner).toBe(true);
    expect(decideGeo({ country: "US", geoMode: "india_only" }).showBanner).toBe(false);
  });

  it("is case-insensitive on country", () => {
    expect(decideGeo({ country: "in", geoMode: "india_only" }).showBanner).toBe(true);
  });

  it("global shows the banner for everyone", () => {
    expect(decideGeo({ country: "US", geoMode: "global" }).showBanner).toBe(true);
  });

  it("custom uses the allowlist", () => {
    expect(
      decideGeo({ country: "LK", geoMode: "custom", customAllowlist: ["in", "LK"] }).showBanner,
    ).toBe(true);
    expect(
      decideGeo({ country: "US", geoMode: "custom", customAllowlist: ["IN"] }).showBanner,
    ).toBe(false);
    expect(decideGeo({ country: "US", geoMode: "custom" }).showBanner).toBe(false);
  });

  it("falls back to India when country is unknown (safe default)", () => {
    const d = decideGeo({ country: null, geoMode: "india_only" });
    expect(d.region).toBe("IN");
    expect(d.showBanner).toBe(true);
  });

  it("defaults nonTargetBehavior to allow_all and passes it through", () => {
    expect(decideGeo({ country: "US", geoMode: "india_only" }).nonTargetBehavior).toBe("allow_all");
    expect(
      decideGeo({ country: "US", geoMode: "india_only", nonTargetBehavior: "block_marketing" })
        .nonTargetBehavior,
    ).toBe("block_marketing");
  });
});
