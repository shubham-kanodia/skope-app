"use client";

import { useState } from "react";
import { copyForLang, type BannerCopy, type BannerSettings, type CfgDataItem, type CfgPurpose } from "@/lib/banner/settings";

/**
 * React rendering of the consent banner, mirrors public/skope.js so the
 * dashboard preview matches what visitors see. Lets you flip between the main
 * banner and the "manage choices" view, and between layouts.
 */
export function BannerPreview({
  settings,
  purposes,
  dataItems = [],
  lang = "en",
}: {
  settings: BannerSettings;
  purposes: CfgPurpose[];
  dataItems?: CfgDataItem[];
  lang?: string;
}) {
  const [view, setView] = useState<"main" | "manage">("main");
  const copy = copyForLang(settings, lang);

  const frameAlign =
    settings.layout === "modal"
      ? "items-center justify-center"
      : settings.layout === "corner"
        ? "items-end justify-end"
        : "items-end justify-center";

  return (
    <div>
      {/* Browser chrome mock */}
      <div className="overflow-hidden rounded-2xl border border-hairline">
        <div className="flex items-center gap-1.5 border-b border-hairline bg-surface-soft px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-hairline" />
          <span className="h-2.5 w-2.5 rounded-full bg-hairline" />
          <span className="h-2.5 w-2.5 rounded-full bg-hairline" />
          <span className="ml-3 truncate text-xs text-muted">your-site.in</span>
        </div>
        <div
          className={`relative flex min-h-[340px] bg-[repeating-linear-gradient(45deg,#fafbfc,#fafbfc_12px,#f4f6f9_12px,#f4f6f9_24px)] p-4 ${frameAlign}`}
        >
          {settings.layout === "modal" && <div className="absolute inset-0 bg-ink/40" />}
          <div
            className={`relative w-full rounded-2xl border border-hairline bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.12)] ${
              settings.layout === "bar" ? "max-w-3xl rounded-b-none" : "max-w-sm"
            }`}
          >
            {view === "main" ? (
              <MainCard settings={settings} copy={copy} lang={lang} onManage={() => setView("manage")} />
            ) : (
              <ManageCard
                settings={settings}
                copy={copy}
                purposes={purposes}
                dataItems={dataItems}
                lang={lang}
                onBack={() => setView("main")}
              />
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex gap-2 text-xs">
        <TabBtn active={view === "main"} onClick={() => setView("main")}>Banner</TabBtn>
        <TabBtn active={view === "manage"} onClick={() => setView("manage")}>Manage choices</TabBtn>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 ${active ? "bg-primary/10 text-primary" : "text-muted hover:text-ink"}`}
    >
      {children}
    </button>
  );
}

function MainCard({ settings, copy, lang, onManage }: { settings: BannerSettings; copy: BannerCopy; lang: string; onManage: () => void }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <strong className="text-[15px] font-semibold text-ink">{copy.heading}</strong>
        {settings.showLangSwitcher && settings.languages.length > 1 && <LangPill settings={settings} lang={lang} />}
      </div>
      <p className="mb-3.5 text-sm text-body">{copy.description}</p>
      <Buttons settings={settings} copy={copy}>
        <button type="button" className="rounded-full px-4 py-2 text-sm font-semibold" style={{ color: settings.accent }} onClick={onManage}>
          {copy.manageLabel}
        </button>
      </Buttons>
    </div>
  );
}

function ManageCard({
  settings,
  copy,
  purposes,
  dataItems,
  lang,
  onBack,
}: {
  settings: BannerSettings;
  copy: BannerCopy;
  purposes: CfgPurpose[];
  dataItems: CfgDataItem[];
  lang: string;
  onBack: () => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <strong className="text-[15px] font-semibold text-ink">{copy.manageLabel}</strong>
        {settings.showLangSwitcher && settings.languages.length > 1 && <LangPill settings={settings} lang={lang} />}
      </div>
      <div className="mb-3.5 max-h-52 space-y-3 overflow-auto">
        {purposes.map((p) => {
          const names = dataItems
            .filter((i) => i.purposeKey === p.key)
            .map((i) => i.name[lang] ?? i.name.en);
          return (
            <label key={p.key} className="flex items-start gap-2.5">
              <input type="checkbox" defaultChecked disabled={p.isEssential} className="mt-1" />
              <span className="flex flex-col">
                <span className="text-sm font-semibold text-ink">
                  {p.name[lang] ?? p.name.en}
                  {p.isEssential && <span className="ml-1.5 text-xs font-normal text-muted">Always on</span>}
                </span>
                <span className="text-[13px] text-body">{p.description[lang] ?? p.description.en}</span>
                {names.length > 0 && (
                  <span className="mt-0.5 text-xs text-muted">Data collected: {names.join(", ")}</span>
                )}
              </span>
            </label>
          );
        })}
      </div>
      <div className="flex gap-2">
        <button type="button" className="rounded-full px-4 py-2 text-sm font-semibold text-white" style={{ background: settings.accent }}>
          Save choices
        </button>
        <button type="button" className="rounded-full px-4 py-2 text-sm font-semibold" style={{ color: settings.accent }} onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  );
}

function Buttons({ settings, copy, children }: { settings: BannerSettings; copy: BannerCopy; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className="rounded-full px-4 py-2 text-sm font-semibold text-white" style={{ background: settings.accent }}>
        {copy.acceptLabel}
      </button>
      <button type="button" className="rounded-full border border-hairline px-4 py-2 text-sm font-semibold text-ink">
        {copy.rejectLabel}
      </button>
      {children}
    </div>
  );
}

const LANG_NAMES: Record<string, string> = { en: "English", hi: "हिन्दी", ta: "தமிழ்", te: "తెలుగు", bn: "বাংলা", mr: "मराठी", kn: "ಕನ್ನಡ", ml: "മലയാളം", gu: "ગુજરાતી", pa: "ਪੰਜਾਬੀ" };

function LangPill({ settings, lang }: { settings: BannerSettings; lang: string }) {
  return (
    <select className="pointer-events-none rounded-lg border border-hairline bg-white px-2 py-1 text-[13px] text-ink" value={lang} onChange={() => {}} tabIndex={-1}>
      {settings.languages.map((l) => (
        <option key={l} value={l}>{LANG_NAMES[l] ?? l}</option>
      ))}
    </select>
  );
}
