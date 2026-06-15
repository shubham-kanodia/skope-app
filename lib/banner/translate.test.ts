import { describe, expect, it, vi, beforeEach } from "vitest";

// Control Google Translate per-language: codes listed in `unsupported` throw.
const unsupported = new Set<string>();
vi.mock("@/lib/translate/google", () => ({
  translateBatch: vi.fn(async (texts: string[], target: string) => {
    if (unsupported.has(target)) throw new Error(`unsupported: ${target}`);
    return texts.map((t) => `${target}:${t}`);
  }),
}));

import { ensureTranslations } from "./translate";
import { DEFAULT_BANNER_SETTINGS, type BannerSettings } from "./settings";

function banner(languages: string[]): BannerSettings {
  return { ...DEFAULT_BANNER_SETTINGS, languages };
}

describe("ensureTranslations graceful degradation", () => {
  beforeEach(() => unsupported.clear());

  it("translates every selected non-default language", async () => {
    const res = await ensureTranslations(banner(["en", "hi", "ta"]));
    expect(res.translated.sort()).toEqual(["hi", "ta"]);
    expect(res.failed).toEqual([]);
    expect(res.translations.hi.heading).toBe(`hi:${DEFAULT_BANNER_SETTINGS.heading}`);
  });

  it("skips a failed language instead of throwing, and reports it", async () => {
    unsupported.add("sat");
    const res = await ensureTranslations(banner(["en", "hi", "sat", "ta"]));
    expect(res.translated.sort()).toEqual(["hi", "ta"]);
    expect(res.failed).toEqual(["sat"]);
    // The failed language has no cache entry → visitors fall back to source copy.
    expect(res.translations.sat).toBeUndefined();
    expect(res.translations.hi).toBeDefined();
    expect(res.translations.ta).toBeDefined();
  });

  it("reports all targets as failed when none can be translated (e.g. no API key)", async () => {
    unsupported.add("hi");
    unsupported.add("ta");
    const res = await ensureTranslations(banner(["en", "hi", "ta"]));
    expect(res.failed.sort()).toEqual(["hi", "ta"]);
    expect(res.translated).toEqual([]);
    expect(res.translations).toEqual({});
  });

  it("re-attempts a previously failed language on the next run (no cache entry)", async () => {
    unsupported.add("sat");
    const first = await ensureTranslations(banner(["en", "sat"]));
    expect(first.failed).toEqual(["sat"]);

    // Now Google supports it; the cached hash matches but sat has no entry, so it retries.
    unsupported.clear();
    const second = await ensureTranslations({
      ...banner(["en", "sat"]),
      translations: first.translations,
      translationsHash: first.translationsHash,
    });
    expect(second.translated).toEqual(["sat"]);
    expect(second.failed).toEqual([]);
    expect(second.translations.sat).toBeDefined();
  });
});
