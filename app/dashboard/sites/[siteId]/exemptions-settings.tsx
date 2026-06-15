"use client";

import { useState } from "react";
import { saveExemptionSettings } from "./actions";
import { Tooltip } from "@/components/ui/tooltip";
import type { ExemptionSettings } from "@/lib/exemptions/settings";

export function ExemptionSettingsEditor({ siteId, initial }: { siteId: string; initial: ExemptionSettings }) {
  const [s17, setS17] = useState(initial.section17);
  const [s9, setS9] = useState(initial.section9);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSave() {
    setState("saving");
    setError(null);
    const res = await saveExemptionSettings(siteId, { section17: s17, section9: s9 });
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
        <h2 className="text-lg text-ink">Exemptions you rely on</h2>
        <Tooltip content="India's DPDP Act exempts some uses of data (sections 17 and 9). If one applies to you, note it here for your records." />
      </div>
      <p className="mt-1 text-sm text-body">
        Optional. If the law lets you skip some steps for a specific reason, write it down here for
        your records. Whether an exemption applies depends on your situation, so confirm it with your
        lawyer.
      </p>
      <div className="mt-4 space-y-3">
        <label className="block">
          <span className="text-xs font-medium text-ink">General exemption</span>
          <textarea
            value={s17}
            onChange={(e) => setS17(e.target.value)}
            rows={2}
            placeholder="e.g. we process this only to enforce a legal claim"
            className="mt-1 w-full rounded-xl border border-hairline bg-canvas px-4 py-2.5 text-sm text-ink outline-none focus:border-primary"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-ink">Children&apos;s-data exemption</span>
          <textarea
            value={s9}
            onChange={(e) => setS9(e.target.value)}
            rows={2}
            placeholder="e.g. a service the government has exempted from the children's rules"
            className="mt-1 w-full rounded-xl border border-hairline bg-canvas px-4 py-2.5 text-sm text-ink outline-none focus:border-primary"
          />
        </label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={onSave}
          disabled={state === "saving"}
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-active disabled:opacity-60"
        >
          {state === "saving" ? "Saving…" : "Save exemptions"}
        </button>
        {state === "saved" && <span className="text-sm text-success">Saved.</span>}
        {state === "error" && error && <span className="text-sm text-amber">{error}</span>}
      </div>
    </section>
  );
}
