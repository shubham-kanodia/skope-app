/**
 * Banner theme + copy. Persisted per-site in sites.settings.banner (jsonb),
 * returned by /api/cfg/:siteKey, consumed by skope.js and the dashboard preview.
 * One source of truth so the preview matches what visitors actually see.
 */
import { MAX_LANGUAGES, isSupportedLanguage } from "./languages";

export type BannerLayout = "bar" | "modal" | "corner";

/** The translatable copy of the banner (the source lives on BannerSettings). */
export interface BannerCopy {
  heading: string;
  description: string;
  acceptLabel: string;
  rejectLabel: string;
  manageLabel: string;
}

export interface BannerSettings extends BannerCopy {
  layout: BannerLayout;
  accent: string; // hex, the "Accept all" button colour
  showLangSwitcher: boolean;
  /** Show a small persistent "Privacy choices" button so visitors can re-open the manage view. */
  showPreferencesButton: boolean;
  languages: string[]; // enabled UI languages, e.g. ["en","hi"]
  /** Machine-translated copy per language (the default language uses the source above). */
  translations?: Record<string, BannerCopy>;
  /** Hash of the source copy the translations were made from, to translate once and cache. */
  translationsHash?: string;
}

/** The copy to show for a language: its translation, falling back to the source. */
export function copyForLang(b: BannerSettings, lang: string): BannerCopy {
  const t = b.translations?.[lang];
  return t ?? { heading: b.heading, description: b.description, acceptLabel: b.acceptLabel, rejectLabel: b.rejectLabel, manageLabel: b.manageLabel };
}

// NOTE: This is a DPDP-aware default template, not legal advice. [HUMAN] Have
// counsel review the notice copy (and the per-purpose descriptions below) before
// launch, see the implementation plan's legal-review checklist.
export const DEFAULT_BANNER_SETTINGS: BannerSettings = {
  layout: "bar",
  accent: "#0052ff",
  heading: "Your consent, your control",
  description:
    "We collect and process personal data to run this site and, with your consent, to measure traffic and show you relevant content. Under India's Digital Personal Data Protection Act, we ask before processing data that isn't strictly necessary. Accept all, reject non-essential processing, or choose by purpose. You can withdraw consent anytime, and contact our grievance officer through our privacy notice.",
  acceptLabel: "Accept all",
  rejectLabel: "Reject non-essential",
  manageLabel: "Manage choices",
  showLangSwitcher: true,
  showPreferencesButton: true,
  languages: ["en", "hi"],
};

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/** Merge stored (untrusted) settings over defaults, clamping every field. */
export function mergeBannerSettings(raw: unknown): BannerSettings {
  const d = DEFAULT_BANNER_SETTINGS;
  if (!raw || typeof raw !== "object") return { ...d };
  const r = raw as Record<string, unknown>;
  const str = (v: unknown, fallback: string, max = 400) =>
    typeof v === "string" && v.trim().length > 0 ? v.slice(0, max) : fallback;

  const layout: BannerLayout =
    r.layout === "modal" || r.layout === "corner" || r.layout === "bar" ? r.layout : d.layout;
  const accent = typeof r.accent === "string" && HEX_RE.test(r.accent) ? r.accent : d.accent;
  const languages =
    Array.isArray(r.languages) && r.languages.every((l) => typeof l === "string") && r.languages.length > 0
      ? (r.languages as string[]).filter(isSupportedLanguage).slice(0, MAX_LANGUAGES)
      : d.languages;
  const safeLanguages = languages.length > 0 ? languages : d.languages;

  // Validate translations: keep only well-formed per-language copy objects.
  let translations: Record<string, BannerCopy> | undefined;
  if (r.translations && typeof r.translations === "object") {
    const out: Record<string, BannerCopy> = {};
    for (const [lang, v] of Object.entries(r.translations as Record<string, unknown>)) {
      if (!v || typeof v !== "object") continue;
      const c = v as Record<string, unknown>;
      const ok = ["heading", "description", "acceptLabel", "rejectLabel", "manageLabel"].every(
        (k) => typeof c[k] === "string",
      );
      if (ok) {
        out[lang.slice(0, 8)] = {
          heading: String(c.heading).slice(0, 120),
          description: String(c.description).slice(0, 600),
          acceptLabel: String(c.acceptLabel).slice(0, 40),
          rejectLabel: String(c.rejectLabel).slice(0, 40),
          manageLabel: String(c.manageLabel).slice(0, 40),
        };
      }
    }
    if (Object.keys(out).length) translations = out;
  }

  return {
    layout,
    accent,
    heading: str(r.heading, d.heading, 120),
    description: str(r.description, d.description, 600),
    acceptLabel: str(r.acceptLabel, d.acceptLabel, 40),
    rejectLabel: str(r.rejectLabel, d.rejectLabel, 40),
    manageLabel: str(r.manageLabel, d.manageLabel, 40),
    showLangSwitcher: typeof r.showLangSwitcher === "boolean" ? r.showLangSwitcher : d.showLangSwitcher,
    showPreferencesButton:
      typeof r.showPreferencesButton === "boolean" ? r.showPreferencesButton : d.showPreferencesButton,
    languages: safeLanguages,
    ...(translations ? { translations } : {}),
    ...(typeof r.translationsHash === "string" ? { translationsHash: r.translationsHash.slice(0, 64) } : {}),
  };
}

/** A declared data item as served by /api/cfg and rendered in the manage view. */
export interface CfgDataItem {
  key: string;
  name: Record<string, string>; // i18n, 'en' always present
  purposeKey: string;
  source?: string | null;
}

/** Default purpose set until per-site purposes CRUD ships (M4). EN + HI. */
export interface CfgPurpose {
  key: string;
  isEssential: boolean;
  name: Record<string, string>;
  description: Record<string, string>;
}

export const DEFAULT_PURPOSES: CfgPurpose[] = [
  {
    key: "necessary",
    isEssential: true,
    name: { en: "Strictly necessary", hi: "अत्यावश्यक" },
    description: {
      en: "Needed for the site to work, security, your session, and saving your choices. Always on.",
      hi: "साइट के काम करने के लिए ज़रूरी, सुरक्षा, सत्र और आपकी पसंद सहेजना। हमेशा चालू।",
    },
  },
  {
    key: "analytics",
    isEssential: false,
    name: { en: "Analytics", hi: "एनालिटिक्स" },
    description: {
      en: "Helps us understand which pages people use so we can improve them.",
      hi: "यह समझने में मदद करता है कि लोग किन पेजों का उपयोग करते हैं ताकि हम उन्हें बेहतर बना सकें।",
    },
  },
  {
    key: "marketing",
    isEssential: false,
    name: { en: "Marketing", hi: "मार्केटिंग" },
    description: {
      en: "Lets us show you more relevant offers and measure our campaigns.",
      hi: "हमें आपको अधिक प्रासंगिक ऑफ़र दिखाने और अभियानों को मापने देता है।",
    },
  },
];
