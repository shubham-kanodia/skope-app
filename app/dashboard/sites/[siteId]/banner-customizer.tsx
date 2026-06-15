"use client";

import { useState, useTransition } from "react";
import { BannerPreview } from "@/components/banner-preview";
import { FieldHint } from "@/components/ui/field-hint";
import { Callout } from "@/components/ui/callout";
import { DEFAULT_PURPOSES, DEFAULT_BANNER_SETTINGS, type BannerSettings, type BannerLayout, type CfgDataItem } from "@/lib/banner/settings";
import { LANGUAGES as LANGS, languageLabel } from "@/lib/banner/languages";
import { saveBannerSettings, previewTranslate } from "./actions";
import { track } from "@/lib/analytics/gtag";

const COPY_FIELDS = new Set<keyof BannerSettings>([
  "heading",
  "description",
  "acceptLabel",
  "rejectLabel",
  "manageLabel",
]);

const LAYOUTS: { id: BannerLayout; label: string }[] = [
  { id: "bar", label: "Bottom bar" },
  { id: "modal", label: "Center modal" },
  { id: "corner", label: "Corner card" },
];

export function BannerCustomizer({
  siteId,
  initial,
  dataItems = [],
  onSaved,
}: {
  siteId: string;
  initial: BannerSettings;
  /** Declared data items, shown in the manage-view preview like skope.js. */
  dataItems?: CfgDataItem[];
  /** Called after a successful save (lets the setup wizard enable "continue"). */
  onSaved?: () => void;
}) {
  const [settings, setSettings] = useState<BannerSettings>(initial);
  const [pending, startTransition] = useTransition();
  const [translating, startTranslate] = useTransition();
  const [status, setStatus] = useState<string | null>(null);
  const [previewLang, setPreviewLang] = useState<string>(initial.languages[0] ?? "en");

  const defaultLang = settings.languages[0] ?? "en";
  const activePreviewLang = settings.languages.includes(previewLang) ? previewLang : defaultLang;

  function set<K extends keyof BannerSettings>(key: K, value: BannerSettings[K]) {
    setSettings((s) => {
      const next = { ...s, [key]: value };
      // Editing the source copy invalidates any cached translations.
      if (COPY_FIELDS.has(key)) {
        delete next.translations;
        delete next.translationsHash;
      }
      return next;
    });
    setStatus(null);
  }

  // Translate on demand when the preview language is switched (cached server-side).
  function selectPreviewLang(lang: string) {
    setPreviewLang(lang);
    if (lang === defaultLang || settings.translations?.[lang]) return;
    startTranslate(async () => {
      const res = await previewTranslate(siteId, settings);
      if (res.translations) {
        setSettings((s) => ({ ...s, translations: res.translations, translationsHash: res.translationsHash }));
        track("banner_preview_translated", {
          translate_chars: res.costs?.translateChars ?? 0,
          translate_languages: res.costs?.translatedLanguages ?? 0,
        });
        if (res.warning) setStatus(res.warning);
      } else if (res.error) {
        setStatus(res.error);
      }
    });
  }

  function toggleLang(code: string) {
    setSettings((s) => {
      const has = s.languages.includes(code);
      const languages = has ? s.languages.filter((l) => l !== code) : [...s.languages, code];
      return { ...s, languages: languages.length ? languages : s.languages };
    });
    setStatus(null);
  }

  function save() {
    startTransition(async () => {
      const res = await saveBannerSettings(siteId, settings);
      if (res.banner) setSettings(res.banner); // sync newly-cached translations into the preview
      if (res.ok) {
        setStatus(res.warning ?? "Saved and translated. Live on your site within a minute.");
        track("banner_saved", {
          layout: settings.layout,
          languages_count: settings.languages.length,
          translate_chars: res.costs?.translateChars ?? 0,
          translate_languages: res.costs?.translatedLanguages ?? 0,
        });
        onSaved?.();
      } else {
        setStatus(res.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Controls */}
      <div className="space-y-6">
        <Field label="Layout">
          <div className="flex gap-2">
            {LAYOUTS.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => set("layout", l.id)}
                className={`rounded-full border px-3.5 py-1.5 text-sm ${
                  settings.layout === l.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-hairline text-body hover:text-ink"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Accent colour" hint="Used for the “Accept all” button. Keep it close to your brand.">
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={settings.accent}
              onChange={(e) => set("accent", e.target.value)}
              className="h-9 w-12 cursor-pointer rounded-lg border border-hairline bg-white p-1"
            />
            <input
              type="text"
              value={settings.accent}
              onChange={(e) => set("accent", e.target.value)}
              className="w-28 rounded-lg border border-hairline px-3 py-2 font-mono text-sm text-ink outline-none focus:border-primary"
            />
          </div>
        </Field>

        <Field label="Heading">
          <Text value={settings.heading} onChange={(v) => set("heading", v)} />
        </Field>

        <Field label="Description" hint="Plain language, what you collect and why.">
          <textarea
            value={settings.description}
            onChange={(e) => set("description", e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-hairline px-3 py-2 text-sm text-ink outline-none focus:border-primary"
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Accept button"><Text value={settings.acceptLabel} onChange={(v) => set("acceptLabel", v)} /></Field>
          <Field label="Reject button"><Text value={settings.rejectLabel} onChange={(v) => set("rejectLabel", v)} /></Field>
          <Field label="Manage button"><Text value={settings.manageLabel} onChange={(v) => set("manageLabel", v)} /></Field>
        </div>

        <Field label="Languages" hint="The first is your default. When you save, the others are auto-translated for you. You can review them in the preview.">
          <div className="flex flex-wrap gap-2">
            {LANGS.map((l) => {
              const on = settings.languages.includes(l.code);
              return (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => toggleLang(l.code)}
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    on ? "border-primary bg-primary/10 text-primary" : "border-hairline text-body hover:text-ink"
                  }`}
                >
                  {l.label}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Language switcher">
          <label className="flex items-center gap-2 text-sm text-body">
            <input
              type="checkbox"
              checked={settings.showLangSwitcher}
              onChange={(e) => set("showLangSwitcher", e.target.checked)}
            />
            Show the language dropdown in the banner
          </label>
        </Field>

        <Field
          label="Privacy choices button"
          hint="A small button on every page so visitors can re-open their choices and withdraw consent at any time, as DPDP requires."
        >
          <label className="flex items-center gap-2 text-sm text-body">
            <input
              type="checkbox"
              checked={settings.showPreferencesButton}
              onChange={(e) => set("showPreferencesButton", e.target.checked)}
            />
            Show a persistent “Privacy choices” button
          </label>
        </Field>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="rounded-full bg-primary px-5 py-2.5 font-medium text-white hover:bg-primary-active disabled:opacity-60"
          >
            {pending ? "Saving & translating…" : "Save banner"}
          </button>
          <button
            type="button"
            onClick={() => { setSettings(DEFAULT_BANNER_SETTINGS); setStatus(null); }}
            className="text-sm text-muted hover:text-ink"
          >
            Reset to defaults
          </button>
          {status && <span className="text-sm text-body">{status}</span>}
        </div>
      </div>

      {/* Live preview */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-ink">Live preview</p>
          {settings.languages.length > 1 && (
            <label className="flex items-center gap-2 text-sm text-body">
              {translating ? "Translating…" : "Preview in"}
              <select
                value={activePreviewLang}
                onChange={(e) => selectPreviewLang(e.target.value)}
                disabled={translating}
                className="rounded-lg border border-hairline px-2 py-1 text-sm text-ink disabled:opacity-60"
              >
                {settings.languages.map((l) => (
                  <option key={l} value={l}>
                    {languageLabel(l)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <BannerPreview settings={settings} purposes={DEFAULT_PURPOSES} dataItems={dataItems} lang={activePreviewLang} />

        {activePreviewLang !== (settings.languages[0] ?? "en") && (
          <div className="mt-3">
            <Callout tone="warn" title="Machine-translated">
              This language was auto-translated. Read it, edit anything that reads
              oddly, and have it reviewed before you rely on it.
            </Callout>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-ink">{label}</p>
      {children}
      {hint && <FieldHint>{hint}</FieldHint>}
    </div>
  );
}

function Text({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-hairline px-3 py-2 text-sm text-ink outline-none focus:border-primary"
    />
  );
}
