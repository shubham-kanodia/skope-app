"use client";

import { useState } from "react";
import { saveRetentionSettings } from "./actions";
import { Tooltip } from "@/components/ui/tooltip";
import type { RetentionSettings } from "@/lib/retention/settings";

const PURPOSES: { key: string; label: string }[] = [
  { key: "analytics", label: "Analytics" },
  { key: "marketing", label: "Marketing" },
];

export function RetentionSettingsEditor({ siteId, initial }: { siteId: string; initial: RetentionSettings }) {
  const [inactivityDays, setInactivityDays] = useState(String(initial.inactivityDays));
  const [perPurpose, setPerPurpose] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const p of PURPOSES) {
      const v = initial.perPurpose[p.key];
      if (typeof v === "number") out[p.key] = String(v);
    }
    return out;
  });
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSave() {
    setState("saving");
    setError(null);
    const overrides: Record<string, number> = {};
    for (const p of PURPOSES) {
      const v = perPurpose[p.key];
      if (v && Number.isFinite(Number(v))) overrides[p.key] = Number(v);
    }
    const res = await saveRetentionSettings(siteId, {
      inactivityDays: Number(inactivityDays),
      perPurpose: overrides,
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
        <h2 className="text-lg text-ink">Data retention</h2>
        <Tooltip content="India's DPDP Act says you shouldn't keep someone's data longer than you need it. Skope reminds you to delete data once a person goes quiet for this long." />
      </div>
      <p className="mt-1 text-sm text-body">
        If a visitor hasn&apos;t used your site for this long, Skope reminds you to delete their data.
        Pick a period that fits your business, and check it with your lawyer.
      </p>

      <div className="mt-4 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-ink">Delete data after this many days of no activity</span>
          <input
            type="number"
            min={1}
            value={inactivityDays}
            onChange={(e) => setInactivityDays(e.target.value)}
            className="mt-2 w-48 rounded-xl border border-hairline bg-canvas px-4 py-2.5 text-sm text-ink outline-none focus:border-primary"
          />
        </label>

        <div>
          <span className="text-sm font-medium text-ink">Use a different period for analytics or marketing (optional)</span>
          <div className="mt-2 flex flex-wrap gap-4">
            {PURPOSES.map((p) => (
              <label key={p.key} className="block">
                <span className="text-xs text-muted">{p.label}</span>
                <input
                  type="number"
                  min={1}
                  placeholder="default"
                  value={perPurpose[p.key] ?? ""}
                  onChange={(e) => setPerPurpose((prev) => ({ ...prev, [p.key]: e.target.value }))}
                  className="mt-1 block w-36 rounded-xl border border-hairline bg-canvas px-4 py-2.5 text-sm text-ink outline-none focus:border-primary"
                />
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={onSave}
          disabled={state === "saving"}
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-active disabled:opacity-60"
        >
          {state === "saving" ? "Saving…" : "Save retention"}
        </button>
        {state === "saved" && <span className="text-sm text-success">Saved.</span>}
        {state === "error" && error && <span className="text-sm text-amber">{error}</span>}
      </div>
    </section>
  );
}
