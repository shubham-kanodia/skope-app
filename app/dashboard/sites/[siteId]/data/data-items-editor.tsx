"use client";

import { useRef, useState } from "react";
import { FieldHint } from "@/components/ui/field-hint";
import { Tooltip } from "@/components/ui/tooltip";
import { DEFAULT_PURPOSES } from "@/lib/banner/settings";
import { DATA_ITEM_CATEGORIES, CATEGORY_LABELS, slugifyKey } from "@/lib/data-items/types";
import type { DataItem, DataItemCategory } from "@/lib/data-items/types";
import { DATA_ITEM_PRESETS } from "@/lib/data-items/presets";
import { saveDataItems } from "./actions";
import { track } from "@/lib/analytics/gtag";

interface Row {
  rowId: number;
  key: string;
  name: string;
  category: DataItemCategory;
  purposeKey: string;
  sourceLabel: string;
  retentionDays: string; // input value; coerced on save
  hint?: string;
}

let nextRowId = 1;

function rowFromItem(i: DataItem): Row {
  return {
    rowId: nextRowId++,
    key: i.key,
    name: i.name.en ?? Object.values(i.name)[0] ?? "",
    category: i.category,
    purposeKey: i.purposeKey,
    sourceLabel: i.sourceLabel ?? "",
    retentionDays: i.retentionDays ? String(i.retentionDays) : "",
  };
}

export function DataItemsEditor({
  siteId,
  initial,
  onSaved,
}: {
  siteId: string;
  initial: DataItem[];
  /** Called after a successful save with at least one item. */
  onSaved?: () => void;
}) {
  const [rows, setRows] = useState<Row[]>(() => initial.map(rowFromItem));
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  function touch() {
    setState("idle");
    setMessage(null);
  }

  function addRow(partial?: Partial<Row>) {
    touch();
    setRows((prev) => [
      ...prev,
      {
        rowId: nextRowId++,
        key: "",
        name: "",
        category: "other",
        purposeKey: "necessary",
        sourceLabel: "",
        retentionDays: "",
        ...partial,
      },
    ]);
  }

  function updateRow(rowId: number, patch: Partial<Row>) {
    touch();
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  }

  function removeRow(rowId: number) {
    touch();
    setRows((prev) => prev.filter((r) => r.rowId !== rowId));
  }

  const presentKeys = new Set(rows.map((r) => r.key || slugifyKey(r.name)));
  const availablePresets = DATA_ITEM_PRESETS.filter((p) => !presentKeys.has(p.key));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("saving");
    setMessage(null);
    const payload = rows
      .filter((r) => r.name.trim())
      .map((r) => ({
        key: r.key || undefined,
        name: r.name,
        category: r.category,
        purposeKey: r.purposeKey,
        sourceLabel: r.sourceLabel || null,
        retentionDays: r.retentionDays ? Number(r.retentionDays) : null,
      }));
    const res = await saveDataItems(siteId, payload);
    if (res.error) {
      setState("error");
      setMessage(res.error);
      return;
    }
    if (res.items) setRows(res.items.map(rowFromItem));
    setState("saved");
    setMessage(res.warning ?? null);
    if (payload.length > 0) onSaved?.();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div>
        <p className="text-sm text-body">
          List each piece of personal data your site collects: from signup forms, checkout,
          contact forms, anywhere. Your privacy notice must itemize these 
          &nbsp;<Tooltip term="dataItem" />, and visitors see them under each purpose in the banner.
        </p>
      </div>

      <ScreenshotPanel
        siteId={siteId}
        onAccept={(items) => {
          touch();
          setRows((prev) => {
            const have = new Set(prev.map((r) => r.key || slugifyKey(r.name)));
            const added = items
              .filter((i) => !have.has(slugifyKey(i.name)))
              .map((i) => ({
                rowId: nextRowId++,
                key: slugifyKey(i.name),
                name: i.name,
                category: i.category,
                purposeKey: i.purposeKey,
                sourceLabel: i.sourceLabel ?? "",
                retentionDays: "",
              }));
            return [...prev, ...added];
          });
        }}
      />

      {availablePresets.length > 0 && (
        <div>
          <p className="text-sm font-medium text-ink">Common items</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {availablePresets.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() =>
                  addRow({ key: p.key, name: p.name, category: p.category, purposeKey: p.purposeKey, hint: p.hint })
                }
                className="rounded-full border border-hairline px-3 py-1.5 text-sm text-body transition-colors hover:border-primary hover:text-primary"
              >
                + {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="space-y-3">
          <div className="hidden gap-2 text-xs font-medium text-muted md:grid md:grid-cols-[1fr_8rem_8rem_10rem_6rem_2rem]">
            <span>What you collect</span>
            <span>Category</span>
            <span>Purpose</span>
            <span>Collected at</span>
            <span className="flex items-center gap-1">
              Keep for <Tooltip term="retention" />
            </span>
            <span />
          </div>
          {rows.map((r) => (
            <div key={r.rowId} className="space-y-1">
              <div className="grid grid-cols-2 items-center gap-2 md:grid-cols-[1fr_8rem_8rem_10rem_6rem_2rem]">
                <input
                  value={r.name}
                  onChange={(e) => updateRow(r.rowId, { name: e.target.value })}
                  placeholder="Email address"
                  className="col-span-2 rounded-xl border border-hairline bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 md:col-span-1"
                />
                <select
                  value={r.category}
                  onChange={(e) => updateRow(r.rowId, { category: e.target.value as DataItemCategory })}
                  className="rounded-xl border border-hairline bg-canvas px-2 py-2 text-sm text-ink outline-none focus:border-primary"
                >
                  {DATA_ITEM_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
                <select
                  value={r.purposeKey}
                  onChange={(e) => updateRow(r.rowId, { purposeKey: e.target.value })}
                  className="rounded-xl border border-hairline bg-canvas px-2 py-2 text-sm text-ink outline-none focus:border-primary"
                >
                  {DEFAULT_PURPOSES.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.name.en}
                    </option>
                  ))}
                </select>
                <input
                  value={r.sourceLabel}
                  onChange={(e) => updateRow(r.rowId, { sourceLabel: e.target.value })}
                  placeholder="Signup form"
                  className="rounded-xl border border-hairline bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <input
                  value={r.retentionDays}
                  onChange={(e) => updateRow(r.rowId, { retentionDays: e.target.value.replace(/[^0-9]/g, "") })}
                  placeholder="Days"
                  inputMode="numeric"
                  className="rounded-xl border border-hairline bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={() => removeRow(r.rowId)}
                  aria-label={`Remove ${r.name || "item"}`}
                  className="justify-self-end text-muted transition-colors hover:text-ink"
                >
                  ✕
                </button>
              </div>
              {r.hint && <FieldHint>{r.hint}</FieldHint>}
            </div>
          ))}
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={() => addRow()}
          className="text-sm font-medium text-primary transition-colors hover:text-primary-active"
        >
          + Add another item
        </button>
      </div>

      {message && <p className={`text-sm ${state === "error" ? "text-ink" : "text-muted"}`}>{message}</p>}

      <div className="flex items-center gap-3 border-t border-hairline pt-4">
        <button
          type="submit"
          disabled={state === "saving"}
          className="rounded-full bg-primary px-6 py-2.5 font-medium text-white transition-colors hover:bg-primary-active disabled:opacity-60"
        >
          {state === "saving" ? "Saving…" : "Save data items"}
        </button>
        {state === "saved" && <span className="text-sm text-success">Saved.</span>}
        {rows.length === 0 && (
          <span className="text-sm text-muted">Add at least one item, even a contact form collects a name and email.</span>
        )}
      </div>
    </form>
  );
}

/** Suggested items returned by the screenshot extraction route. */
interface SuggestedItem {
  name: string;
  category: DataItemCategory;
  purposeKey: string;
  sourceLabel?: string | null;
}

function ScreenshotPanel({
  siteId,
  onAccept,
}: {
  siteId: string;
  onAccept: (items: SuggestedItem[]) => void;
}) {
  const [state, setState] = useState<"idle" | "reading" | "review" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<(SuggestedItem & { checked: boolean })[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setState("error");
      setMessage("That image is over 5 MB. Try a smaller screenshot.");
      return;
    }
    setState("reading");
    setMessage(null);
    const fileKb = Math.round(file.size / 1024);
    const body = new FormData();
    body.set("image", file);
    body.set("siteId", siteId);
    try {
      const res = await fetch("/api/dashboard/data-items/extract", { method: "POST", body });
      const data = (await res.json()) as { items?: SuggestedItem[]; error?: string };
      if (!res.ok || !data.items || data.items.length === 0) {
        if (!res.ok) track("data_extract_failed", { status: res.status, file_kb: fileKb });
        setState("error");
        setMessage(data.error ?? "Couldn't read the screenshot. Add items manually below.");
        return;
      }
      track("data_extract_completed", { items_count: data.items.length, file_kb: fileKb });
      setSuggestions(data.items.map((i) => ({ ...i, checked: true })));
      setState("review");
    } catch {
      setState("error");
      setMessage("Couldn't read the screenshot. Add items manually below.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="rounded-2xl border border-dashed border-hairline p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink">Have a form? Upload a screenshot</p>
          <FieldHint>
            We read the screenshot once to suggest fields, then discard it. Nothing is stored.
          </FieldHint>
        </div>
        <label className="cursor-pointer rounded-full border border-hairline px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-strong">
          {state === "reading" ? "Reading…" : "Choose image"}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            disabled={state === "reading"}
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </label>
      </div>

      {state === "error" && message && <p className="mt-3 text-sm text-ink">{message}</p>}

      {state === "review" && (
        <div className="mt-4 space-y-2 border-t border-hairline pt-4">
          <p className="text-sm text-body">We found these fields. Untick any that aren&apos;t personal data.</p>
          {suggestions.map((s, i) => (
            <label key={i} className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={s.checked}
                onChange={(e) =>
                  setSuggestions((prev) => prev.map((p, j) => (j === i ? { ...p, checked: e.target.checked } : p)))
                }
              />
              {s.name}
              <span className="text-xs text-muted">{CATEGORY_LABELS[s.category] ?? s.category}</span>
            </label>
          ))}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                onAccept(suggestions.filter((s) => s.checked));
                setSuggestions([]);
                setState("idle");
              }}
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-active"
            >
              Add selected
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
