/**
 * Retention settings, persisted per-site in sites.settings.retention (jsonb).
 *
 * DPDP §8(8): a purpose is "no longer served" once a prescribed period of
 * principal inactivity passes, at which point §8(7) requires erasure. The
 * prescribed period is set by the Rules; until it's notified, [HUMAN] this
 * defaults to a conservative 3 years and is configurable per site (and per
 * non-essential purpose). Counsel should confirm the period before relying on it.
 */
export interface RetentionSettings {
  /** Days of principal inactivity after which the purpose is treated as no longer served. */
  inactivityDays: number;
  /** Optional per-purpose overrides (purpose key → days). */
  perPurpose: Record<string, number>;
}

// [HUMAN] Rules-dependent. 3 years is a defensible interim default, not advice.
export const DEFAULT_RETENTION_SETTINGS: RetentionSettings = {
  inactivityDays: 1095,
  perPurpose: {},
};

const MIN_DAYS = 1;
const MAX_DAYS = 36_500; // 100 years, a sane upper bound

function clampDays(v: unknown, fallback: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  return Math.min(MAX_DAYS, Math.max(MIN_DAYS, Math.round(v)));
}

export function mergeRetentionSettings(raw: unknown): RetentionSettings {
  const d = DEFAULT_RETENTION_SETTINGS;
  if (!raw || typeof raw !== "object") return { ...d, perPurpose: {} };
  const r = raw as Record<string, unknown>;

  const perPurpose: Record<string, number> = {};
  if (r.perPurpose && typeof r.perPurpose === "object") {
    for (const [key, value] of Object.entries(r.perPurpose as Record<string, unknown>)) {
      if (typeof value === "number" && Number.isFinite(value)) {
        perPurpose[key.slice(0, 40)] = clampDays(value, d.inactivityDays);
      }
    }
  }

  return {
    inactivityDays: clampDays(r.inactivityDays, d.inactivityDays),
    perPurpose,
  };
}

export function retentionFromSettings(settings: Record<string, unknown>): RetentionSettings {
  return mergeRetentionSettings((settings as { retention?: unknown }).retention);
}

/** Effective inactivity window for a purpose (override → site default). */
export function windowForPurpose(s: RetentionSettings, purposeKey: string): number {
  return s.perPurpose[purposeKey] ?? s.inactivityDays;
}
