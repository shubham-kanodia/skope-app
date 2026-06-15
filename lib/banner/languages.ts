/**
 * The languages Skope offers for banners and notices: English plus all 22 from
 * the Eighth Schedule of the Constitution of India. DPDP §5(3) requires the
 * notice be available in English or any Eighth Schedule language, so this is the
 * full set a Data Fiduciary may need.
 *
 * `code` is the auto-translate target sent to Google Cloud Translation, so it
 * must match Google's language code exactly (a few are non-ISO: Konkani "gom",
 * Bodo "brx", Manipuri/Meitei "mni-Mtei"). `label` is the language's own name in
 * its own script, so the picker reads natively. This is the single source of
 * truth, the banner picker and the storage cap both derive from it.
 */
export interface LanguageOption {
  code: string;
  /** Native-script name, shown in the picker. */
  label: string;
  /** English name, for tooltips and the assistant. */
  english: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: "en", label: "English", english: "English" },
  { code: "hi", label: "हिन्दी", english: "Hindi" },
  { code: "bn", label: "বাংলা", english: "Bengali" },
  { code: "mr", label: "मराठी", english: "Marathi" },
  { code: "te", label: "తెలుగు", english: "Telugu" },
  { code: "ta", label: "தமிழ்", english: "Tamil" },
  { code: "gu", label: "ગુજરાતી", english: "Gujarati" },
  { code: "ur", label: "اردو", english: "Urdu" },
  { code: "kn", label: "ಕನ್ನಡ", english: "Kannada" },
  { code: "or", label: "ଓଡ଼ିଆ", english: "Odia" },
  { code: "ml", label: "മലയാളം", english: "Malayalam" },
  { code: "pa", label: "ਪੰਜਾਬੀ", english: "Punjabi" },
  { code: "as", label: "অসমীয়া", english: "Assamese" },
  { code: "mai", label: "मैथिली", english: "Maithili" },
  { code: "sat", label: "ᱥᱟᱱᱛᱟᱲᱤ", english: "Santali" },
  { code: "ks", label: "کٲشُر", english: "Kashmiri" },
  { code: "ne", label: "नेपाली", english: "Nepali" },
  { code: "sd", label: "سنڌي", english: "Sindhi" },
  { code: "gom", label: "कोंकणी", english: "Konkani" },
  { code: "doi", label: "डोगरी", english: "Dogri" },
  { code: "mni-Mtei", label: "ꯃꯤꯇꯩ ꯂꯣꯟ", english: "Manipuri (Meitei)" },
  { code: "brx", label: "बर'", english: "Bodo" },
  { code: "sa", label: "संस्कृतम्", english: "Sanskrit" },
];

/** Maximum languages a site can enable at once (English + 22 Eighth Schedule). */
export const MAX_LANGUAGES = LANGUAGES.length;

const BY_CODE = new Map(LANGUAGES.map((l) => [l.code, l]));

/** Native-script label for a code, or the code itself when unknown. */
export function languageLabel(code: string): string {
  return BY_CODE.get(code)?.label ?? code;
}

/** True when the code is one Skope offers (and Google can translate). */
export function isSupportedLanguage(code: string): boolean {
  return BY_CODE.has(code);
}
