"use client";

import { useState } from "react";
import { Callout } from "@/components/ui/callout";
import { generatePolicy, savePolicyDraft, publishPolicy } from "./actions";
import type { PolicyContent } from "@/lib/policy/types";
import type { NoticeRow } from "@/lib/notices/store";

function englishOf(notice: NoticeRow | null): PolicyContent | null {
  if (!notice) return null;
  const map = notice.contentI18n;
  return map.en ?? Object.values(map)[0] ?? null;
}

export function PolicyEditor({
  siteId,
  siteKey,
  initial,
  contactReady,
  onPublished,
}: {
  siteId: string;
  siteKey: string;
  initial: NoticeRow | null;
  contactReady: boolean;
  /** Called after the notice is published (advances the setup wizard). */
  onPublished?: () => void;
}) {
  const [notice, setNotice] = useState<NoticeRow | null>(initial);
  const [content, setContent] = useState<PolicyContent | null>(englishOf(initial));
  const [busy, setBusy] = useState<null | "generate" | "save" | "publish" | "edit">(null);
  const [message, setMessage] = useState<string | null>(null);
  const [source, setSource] = useState<"ai" | "template" | null>(null);
  const [tab, setTab] = useState<"edit" | "preview">("preview");

  const isDraft = notice !== null && notice.publishedAt === null;
  const publicPath = `/p/${siteKey}/privacy`;

  async function onGenerate() {
    setBusy("generate");
    setMessage(null);
    const res = await generatePolicy(siteId);
    setBusy(null);
    if (res.error) return setMessage(res.error);
    if (res.notice) {
      setNotice(res.notice);
      setContent(englishOf(res.notice));
      setSource(res.source ?? null);
      setTab("edit");
    }
  }

  async function onSave() {
    if (!content) return;
    setBusy("save");
    setMessage(null);
    const res = await savePolicyDraft(siteId, content);
    setBusy(null);
    if (res.error) return setMessage(res.error);
    if (res.notice) setNotice(res.notice);
    setMessage("Draft saved.");
  }

  // Turn a published notice into an editable draft (a new version) to revise it.
  async function onEditPublished() {
    if (!content) return;
    setBusy("edit");
    setMessage(null);
    const res = await savePolicyDraft(siteId, content);
    setBusy(null);
    if (res.error) return setMessage(res.error);
    if (res.notice) {
      setNotice(res.notice);
      setContent(englishOf(res.notice));
      setTab("edit");
    }
  }

  async function onPublish() {
    setBusy("publish");
    setMessage(null);
    const res = await publishPolicy(siteId);
    setBusy(null);
    if (res.error) return setMessage(res.error);
    if (res.notice) {
      setNotice(res.notice);
      setContent(englishOf(res.notice));
      setTab("preview");
    }
    setMessage("Published. Your notice is live.");
    onPublished?.();
  }

  function patch(next: Partial<PolicyContent>) {
    setContent((prev) => (prev ? { ...prev, ...next } : prev));
  }
  function patchSection(i: number, key: "heading" | "body", value: string) {
    setContent((prev) => {
      if (!prev) return prev;
      const sections = prev.sections.map((s, idx) => (idx === i ? { ...s, [key]: value } : s));
      return { ...prev, sections };
    });
  }
  function removeSection(i: number) {
    setContent((prev) => (prev ? { ...prev, sections: prev.sections.filter((_, idx) => idx !== i) } : prev));
  }
  function addSection() {
    setContent((prev) => (prev ? { ...prev, sections: [...prev.sections, { heading: "", body: "" }] } : prev));
  }

  // --- empty state: nothing generated yet ---
  if (!notice || !content) {
    return (
      <div className="max-w-2xl space-y-5">
        {!contactReady && <ContactWarning siteId={siteId} />}
        <p className="text-body">
          We&apos;ll draft a DPDP privacy notice from your site settings, your purposes, the trackers we
          detect, and your contact details. You can edit every line before it goes live.
        </p>
        <button
          onClick={onGenerate}
          disabled={busy !== null}
          className="rounded-full bg-primary px-5 py-2.5 font-medium text-white transition-colors hover:bg-primary-active disabled:opacity-60"
        >
          {busy === "generate" ? "Generating…" : "Generate my privacy notice"}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      {!contactReady && <ContactWarning siteId={siteId} />}

      <Callout title="AI-generated for your convenience">
        We drafted this for you{source === "template" ? " from a template" : ""}. Read it carefully and
        edit anything that doesn&apos;t fit before you publish, it isn&apos;t legal advice.
      </Callout>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          {isDraft ? `Draft, not live yet.` : `Published version ${notice.version}, live now.`}
        </p>
        <div className="flex rounded-full border border-hairline p-0.5 text-sm">
          {(["edit", "preview"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-3.5 py-1 capitalize transition-colors ${
                tab === t ? "bg-primary/10 font-medium text-primary" : "text-body hover:text-ink"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {tab === "preview" ? (
        <Preview content={content} />
      ) : (
        <Editor
          content={content}
          editable={isDraft}
          onTitle={(v) => patch({ title: v })}
          onIntro={(v) => patch({ intro: v })}
          onSection={patchSection}
          onRemove={removeSection}
          onAdd={addSection}
        />
      )}

      {message && <p className="text-sm text-ink">{message}</p>}

      <div className="flex flex-wrap items-center gap-3">
        {isDraft ? (
          <>
            <button
              onClick={onSave}
              disabled={busy !== null}
              className="rounded-full border border-hairline px-5 py-2.5 font-medium text-ink transition-colors hover:bg-surface-soft disabled:opacity-60"
            >
              {busy === "save" ? "Saving…" : "Save draft"}
            </button>
            <button
              onClick={onPublish}
              disabled={busy !== null}
              className="rounded-full bg-primary px-5 py-2.5 font-medium text-white transition-colors hover:bg-primary-active disabled:opacity-60"
            >
              {busy === "publish" ? "Publishing…" : "Publish"}
            </button>
            <button
              onClick={onGenerate}
              disabled={busy !== null}
              className="text-sm text-muted hover:text-ink"
            >
              {busy === "generate" ? "Regenerating…" : "Start over"}
            </button>
          </>
        ) : (
          <>
            <a
              href={publicPath}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-primary px-5 py-2.5 font-medium text-white transition-colors hover:bg-primary-active"
            >
              View published page
            </a>
            <button
              onClick={onEditPublished}
              disabled={busy !== null}
              className="rounded-full border border-hairline px-5 py-2.5 font-medium text-ink transition-colors hover:bg-surface-soft disabled:opacity-60"
            >
              {busy === "edit" ? "Opening…" : "Edit notice"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ContactWarning({ siteId }: { siteId: string }) {
  return (
    <Callout tone="warn" title="Add your grievance contact first">
      Your notice needs a grievance officer. Fill in the{" "}
      <a href={`/dashboard/sites/${siteId}/contact`} className="font-medium text-primary hover:text-primary-active">
        Contact
      </a>{" "}
      tab, then generate, so the notice includes a working contact instead of a placeholder.
    </Callout>
  );
}

function Preview({ content }: { content: PolicyContent }) {
  return (
    <article className="rounded-2xl border border-hairline p-8">
      <h2 className="text-2xl text-ink">{content.title}</h2>
      {content.intro && <Prose text={content.intro} className="mt-3" />}
      <div className="mt-6 space-y-6">
        {content.sections.map((s, i) => (
          <section key={i}>
            <h3 className="text-base font-medium text-ink">{s.heading}</h3>
            <Prose text={s.body} className="mt-1.5" />
          </section>
        ))}
      </div>
    </article>
  );
}

function Prose({ text, className = "" }: { text: string; className?: string }) {
  const paras = text.split(/\n{2,}/).filter((p) => p.trim().length > 0);
  return (
    <div className={`space-y-2 ${className}`}>
      {paras.map((p, i) => (
        <p key={i} className="whitespace-pre-line text-body">
          {p}
        </p>
      ))}
    </div>
  );
}

function Editor({
  content,
  editable,
  onTitle,
  onIntro,
  onSection,
  onRemove,
  onAdd,
}: {
  content: PolicyContent;
  editable: boolean;
  onTitle: (v: string) => void;
  onIntro: (v: string) => void;
  onSection: (i: number, key: "heading" | "body", v: string) => void;
  onRemove: (i: number) => void;
  onAdd: () => void;
}) {
  const field =
    "w-full rounded-xl border border-hairline bg-canvas px-4 py-2.5 text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-surface-soft disabled:text-body";
  return (
    <div className="space-y-5 rounded-2xl border border-hairline p-6">
      <div>
        <label className="block text-sm font-medium text-ink">Title</label>
        <input value={content.title} onChange={(e) => onTitle(e.target.value)} disabled={!editable} className={`mt-1.5 ${field}`} />
      </div>
      <div>
        <label className="block text-sm font-medium text-ink">Intro</label>
        <textarea value={content.intro} onChange={(e) => onIntro(e.target.value)} disabled={!editable} rows={3} className={`mt-1.5 ${field}`} />
      </div>
      {content.sections.map((s, i) => (
        <div key={i} className="space-y-2 border-t border-hairline pt-4">
          <div className="flex items-center gap-2">
            <input
              value={s.heading}
              onChange={(e) => onSection(i, "heading", e.target.value)}
              disabled={!editable}
              placeholder="Section heading"
              className={`flex-1 font-medium ${field}`}
            />
            {editable && (
              <button onClick={() => onRemove(i)} className="text-sm text-muted hover:text-ink" type="button">
                Remove
              </button>
            )}
          </div>
          <textarea
            value={s.body}
            onChange={(e) => onSection(i, "body", e.target.value)}
            disabled={!editable}
            rows={5}
            className={`text-sm ${field}`}
          />
        </div>
      ))}
      {editable && (
        <button onClick={onAdd} type="button" className="text-sm font-medium text-primary hover:text-primary-active">
          + Add section
        </button>
      )}
    </div>
  );
}
