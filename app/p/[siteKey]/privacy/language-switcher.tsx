"use client";

import { useRouter } from "next/navigation";
import { LANGUAGES, languageLabel } from "@/lib/banner/languages";

/**
 * Language picker for the public privacy notice. The notice is stored per
 * enabled language; this just navigates to ?lang=<code>, which the server page
 * reads. Ordered by the canonical Eighth Schedule list so it reads predictably.
 */
export function LanguageSwitcher({
  siteKey,
  current,
  available,
}: {
  siteKey: string;
  current: string;
  available: string[];
}) {
  const router = useRouter();
  const ordered = LANGUAGES.filter((l) => available.includes(l.code)).map((l) => l.code);
  if (ordered.length < 2) return null;

  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      Language
      <select
        value={current}
        onChange={(e) => router.push(`/p/${siteKey}/privacy?lang=${e.target.value}`)}
        className="rounded-lg border border-hairline bg-canvas px-2 py-1 text-sm text-ink"
      >
        {ordered.map((code) => (
          <option key={code} value={code}>
            {languageLabel(code)}
          </option>
        ))}
      </select>
    </label>
  );
}
