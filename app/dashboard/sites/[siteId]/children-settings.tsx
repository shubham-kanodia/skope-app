"use client";

import { useState } from "react";
import { saveChildrenSettings } from "./actions";
import { Tooltip } from "@/components/ui/tooltip";
import type { ChildrenSettings } from "@/lib/children/settings";

export function ChildrenSettingsEditor({ siteId, initial }: { siteId: string; initial: ChildrenSettings }) {
  const [directedAtChildren, setDirected] = useState(initial.directedAtChildren);
  const [childMode, setChildMode] = useState(initial.childMode === "age_gate");
  const [exemptClass, setExempt] = useState(initial.exemptClass ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSave() {
    setState("saving");
    setError(null);
    const res = await saveChildrenSettings(siteId, {
      directedAtChildren,
      childMode: childMode ? "age_gate" : "off",
      exemptClass: exemptClass.trim() || null,
    });
    if (res.error) {
      setState("error");
      setError(res.error);
      return;
    }
    setState("saved");
  }

  return (
    <section className="rounded-2xl border border-hairline p-5">
      <div className="flex items-center gap-1.5">
        <h2 className="text-lg text-ink">Children&apos;s data</h2>
        <Tooltip content="India's DPDP Act needs a parent or guardian's consent before you handle a child's data, and you can't track children." />
      </div>
      <p className="mt-1 text-sm text-body">
        If children under 18 use your site, turn on child mode. The banner asks the visitor&apos;s age,
        keeps tracking off for children, and asks a parent or guardian to approve before anything
        non-essential. Have your lawyer review your approach.
      </p>

      <div className="mt-4 space-y-3">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={directedAtChildren}
            onChange={(e) => setDirected(e.target.checked)}
            className="mt-1"
          />
          <span className="text-sm text-ink">
            This service is directed at, or likely used by, children under 18
          </span>
        </label>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={childMode}
            onChange={(e) => setChildMode(e.target.checked)}
            className="mt-1"
          />
          <span className="text-sm text-ink">
            Turn on child mode (ask age, then get a parent&apos;s approval)
            <span className="mt-0.5 block text-xs text-muted">
              When on, the banner asks &quot;Are you 18 or older?&quot; before consent.
            </span>
          </span>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-ink">Exemption you rely on (optional)</span>
          <span className="mt-0.5 block text-xs text-muted">
            If the government has exempted your business or purpose, note it here for your records.
          </span>
          <input
            type="text"
            value={exemptClass}
            onChange={(e) => setExempt(e.target.value)}
            placeholder="e.g. a healthcare service the government has exempted"
            className="mt-2 w-full rounded-xl border border-hairline bg-canvas px-4 py-2.5 text-sm text-ink outline-none focus:border-primary"
          />
        </label>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={onSave}
          disabled={state === "saving"}
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-active disabled:opacity-60"
        >
          {state === "saving" ? "Saving…" : "Save children's settings"}
        </button>
        {state === "saved" && <span className="text-sm text-success">Saved.</span>}
        {state === "error" && error && <span className="text-sm text-amber">{error}</span>}
      </div>
    </section>
  );
}
