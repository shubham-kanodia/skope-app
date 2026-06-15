"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { recordBreach } from "./actions";
import { BREACH_DATA_CATEGORIES } from "@/lib/breach/types";

type SiteOption = { id: string; domain: string };

/** Default the "detected at" field to now, formatted for datetime-local. */
function nowLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function BreachForm({ sites }: { sites: SiteOption[] }) {
  const router = useRouter();
  const [siteId, setSiteId] = useState<string>("");
  const [detectedAt, setDetectedAt] = useState(nowLocal());
  const [nature, setNature] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [estAffected, setEstAffected] = useState("");
  const [remediation, setRemediation] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function toggleCategory(c: string) {
    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("saving");
    setError(null);
    const res = await recordBreach(
      {
        detectedAt: new Date(detectedAt).toISOString(),
        nature,
        dataCategories: categories,
        estAffected: estAffected ? Number(estAffected) : null,
        remediation,
      },
      siteId || null,
    );
    if (res.error || !res.id) {
      setState("error");
      setError(res.error ?? "Couldn't save.");
      return;
    }
    router.push(`/dashboard/compliance/breach/${res.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field label="Which site?" hint="Leave blank if the breach isn't specific to one site.">
        <select
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
          className="w-full rounded-xl border border-hairline bg-canvas px-4 py-2.5 text-sm text-ink outline-none focus:border-primary"
        >
          <option value="">All / not site-specific</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.domain}
            </option>
          ))}
        </select>
      </Field>

      <Field label="When did you detect it?" hint="The notification clock starts here.">
        <input
          type="datetime-local"
          value={detectedAt}
          onChange={(e) => setDetectedAt(e.target.value)}
          required
          className="w-full rounded-xl border border-hairline bg-canvas px-4 py-2.5 text-sm text-ink outline-none focus:border-primary"
        />
      </Field>

      <Field label="What happened?" hint="Plain description of the incident: how data was exposed, lost, or accessed.">
        <textarea
          value={nature}
          onChange={(e) => setNature(e.target.value)}
          rows={4}
          required
          placeholder="e.g. A misconfigured storage bucket exposed customer contact records for 6 hours."
          className="w-full rounded-xl border border-hairline bg-canvas px-4 py-2.5 text-sm text-ink outline-none focus:border-primary"
        />
      </Field>

      <Field label="Categories of data involved" hint="Pick all that apply.">
        <div className="flex flex-wrap gap-2">
          {BREACH_DATA_CATEGORIES.map((c) => {
            const on = categories.includes(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() => toggleCategory(c)}
                className={`rounded-full border px-3 py-1.5 text-xs ${
                  on
                    ? "border-primary bg-primary/10 font-medium text-primary"
                    : "border-hairline text-body hover:bg-surface-soft"
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Estimated people affected" hint="A best estimate is fine; you can refine it later.">
        <input
          type="number"
          min={0}
          value={estAffected}
          onChange={(e) => setEstAffected(e.target.value)}
          placeholder="e.g. 1200"
          className="w-48 rounded-xl border border-hairline bg-canvas px-4 py-2.5 text-sm text-ink outline-none focus:border-primary"
        />
      </Field>

      <Field label="Remediation so far" hint="What you've done or plan to do to contain it and reduce harm.">
        <textarea
          value={remediation}
          onChange={(e) => setRemediation(e.target.value)}
          rows={3}
          placeholder="e.g. Closed the bucket, rotated keys, engaged a forensics vendor."
          className="w-full rounded-xl border border-hairline bg-canvas px-4 py-2.5 text-sm text-ink outline-none focus:border-primary"
        />
      </Field>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={state === "saving"}
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-active disabled:opacity-60"
        >
          {state === "saving" ? "Saving…" : "Record incident"}
        </button>
        {error && <span className="text-sm text-amber">{error}</span>}
      </div>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink">{label}</span>
      {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
      <div className="mt-2">{children}</div>
    </label>
  );
}
