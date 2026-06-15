"use client";

import { useState } from "react";
import { saveRecipients } from "./actions";
import { Tooltip } from "@/components/ui/tooltip";
import { isRestrictedCountry } from "@/lib/recipients/restricted-countries";
import {
  RECIPIENT_ROLES,
  ROLE_LABELS,
  CONTRACT_STATUSES,
  type Recipient,
  type RecipientInput,
} from "@/lib/recipients/types";

type Row = RecipientInput;
type DataItemRef = { key: string; name: string };

function toRow(r: Recipient): Row {
  return {
    name: r.name,
    role: r.role,
    purpose: r.purpose,
    dataItemKeys: r.dataItemKeys,
    country: r.country,
    contractRef: r.contractRef,
    contractStatus: r.contractStatus,
    webhookUrl: r.webhookUrl,
  };
}

function emptyRow(): Row {
  return {
    name: "",
    role: "processor",
    purpose: null,
    dataItemKeys: [],
    country: null,
    contractRef: null,
    contractStatus: null,
    webhookUrl: null,
  };
}

export function RecipientsEditor({
  siteId,
  initial,
  dataItems,
}: {
  siteId: string;
  initial: Recipient[];
  dataItems: DataItemRef[];
}) {
  const [rows, setRows] = useState<Row[]>(initial.map(toRow));
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function update(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }
  function remove(i: number) {
    setRows((prev) => prev.filter((_, j) => j !== i));
  }
  function add() {
    setRows((prev) => [...prev, emptyRow()]);
  }
  function toggleKey(i: number, key: string) {
    setRows((prev) =>
      prev.map((r, j) => {
        if (j !== i) return r;
        const has = r.dataItemKeys.includes(key);
        return { ...r, dataItemKeys: has ? r.dataItemKeys.filter((k) => k !== key) : [...r.dataItemKeys, key] };
      }),
    );
  }

  async function onSave() {
    setState("saving");
    setError(null);
    const res = await saveRecipients(siteId, rows);
    if (res.error) {
      setState("error");
      setError(res.error);
      return;
    }
    if (res.recipients) setRows(res.recipients.map(toRow));
    setState("saved");
  }

  return (
    <section className="rounded-2xl border border-hairline p-5">
      <div className="flex items-center gap-1.5">
        <h2 className="text-lg text-ink">Who you share data with</h2>
        <Tooltip content="India's DPDP Act says you must tell people who you share their data with, and keep a contract with any vendor that handles it for you." />
      </div>
      <p className="mt-1 text-sm text-body">
        List the companies you share personal data with, like a payment provider or an analytics tool.
        Skope adds them to your privacy notice and uses them to answer access requests.
      </p>

      <div className="mt-4 space-y-4">
        {rows.map((r, i) => {
          const restricted = isRestrictedCountry(r.country);
          return (
            <div key={i} className="rounded-xl border border-hairline p-4">
              <div className="flex flex-wrap gap-3">
                <Field label="Name" className="min-w-48 flex-1">
                  <input
                    value={r.name}
                    onChange={(e) => update(i, { name: e.target.value })}
                    placeholder="e.g. Razorpay"
                    className={inputCls}
                  />
                </Field>
                <Field label="Role">
                  <select value={r.role} onChange={(e) => update(i, { role: e.target.value as Row["role"] })} className={inputCls}>
                    {RECIPIENT_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Country (ISO-2)">
                  <input
                    value={r.country ?? ""}
                    onChange={(e) => update(i, { country: e.target.value.toUpperCase().slice(0, 2) || null })}
                    placeholder="IN"
                    className={`${inputCls} w-24 ${restricted ? "border-amber" : ""}`}
                  />
                </Field>
              </div>

              <Field label="Purpose" className="mt-3">
                <input
                  value={r.purpose ?? ""}
                  onChange={(e) => update(i, { purpose: e.target.value || null })}
                  placeholder="Why they receive the data, e.g. payment processing"
                  className={inputCls}
                />
              </Field>

              {dataItems.length > 0 && (
                <div className="mt-3">
                  <span className="text-xs font-medium text-ink">Data shared</span>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {dataItems.map((d) => {
                      const on = r.dataItemKeys.includes(d.key);
                      return (
                        <button
                          key={d.key}
                          type="button"
                          onClick={() => toggleKey(i, d.key)}
                          className={`rounded-full border px-2.5 py-1 text-xs ${
                            on ? "border-primary bg-primary/10 text-primary" : "border-hairline text-body hover:bg-surface-soft"
                          }`}
                        >
                          {d.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {r.role === "processor" && (
                <div className="mt-3 flex flex-wrap gap-3">
                  <Field label="Contract reference" className="min-w-48 flex-1">
                    <input
                      value={r.contractRef ?? ""}
                      onChange={(e) => update(i, { contractRef: e.target.value || null })}
                      placeholder="DPA ref / document ID"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Contract status">
                    <select
                      value={r.contractStatus ?? ""}
                      onChange={(e) => update(i, { contractStatus: (e.target.value || null) as Row["contractStatus"] })}
                      className={inputCls}
                    >
                      <option value="">, </option>
                      {CONTRACT_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Stop-processing webhook (optional)" className="min-w-48 flex-1">
                    <input
                      value={r.webhookUrl ?? ""}
                      onChange={(e) => update(i, { webhookUrl: e.target.value || null })}
                      placeholder="https://vendor.example/skope/cease"
                      className={inputCls}
                    />
                  </Field>
                </div>
              )}

              {restricted && (
                <p className="mt-2 text-xs text-amber">
                  The government restricts sending data to this country. Check before you share.
                </p>
              )}

              <button onClick={() => remove(i)} className="mt-3 text-xs text-muted hover:text-amber">
                Remove
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button onClick={add} className="rounded-full border border-hairline px-4 py-2 text-sm font-medium text-ink hover:bg-surface-soft">
          Add recipient
        </button>
        <button
          onClick={onSave}
          disabled={state === "saving"}
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-active disabled:opacity-60"
        >
          {state === "saving" ? "Saving…" : "Save recipients"}
        </button>
        {state === "saved" && <span className="text-sm text-success">Saved.</span>}
        {state === "error" && error && <span className="text-sm text-amber">{error}</span>}
      </div>
    </section>
  );
}

const inputCls =
  "w-full rounded-xl border border-hairline bg-canvas px-4 py-2.5 text-sm text-ink outline-none focus:border-primary";

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="text-xs font-medium text-ink">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
