"use client";

import { useState } from "react";
import { recordNomination, updateNomination } from "./actions";
import { NOMINATION_STATUS_LABELS, type NominationRow, type NominationStatus } from "@/lib/nominations/types";

type SiteOption = { id: string; domain: string };
const inputCls =
  "w-full rounded-xl border border-hairline bg-canvas px-4 py-2.5 text-sm text-ink outline-none focus:border-primary";
const when = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });

export function NominationsManager({ sites, initial }: { sites: SiteOption[]; initial: NominationRow[] }) {
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [principalRef, setPrincipalRef] = useState("");
  const [nomineeName, setNomineeName] = useState("");
  const [nomineeContact, setNomineeContact] = useState("");
  const [relationship, setRelationship] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState(initial);

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await recordNomination({ siteId, principalRef, nomineeName, nomineeContact, relationship });
    setBusy(false);
    if (res.error) return setError(res.error);
    if (res.row) setRows((prev) => [res.row!, ...prev]);
    setPrincipalRef("");
    setNomineeName("");
    setNomineeContact("");
    setRelationship("");
  }

  async function move(id: string, status: NominationStatus) {
    const res = await updateNomination(id, status);
    if (!res.error) setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-hairline p-5">
        <h2 className="text-lg text-ink">Record a nominee</h2>
        <div className="mt-4 space-y-3">
          {sites.length > 1 && (
            <select value={siteId} onChange={(e) => setSiteId(e.target.value)} className={inputCls}>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.domain}
                </option>
              ))}
            </select>
          )}
          <input value={principalRef} onChange={(e) => setPrincipalRef(e.target.value)} placeholder="Principal reference (e.g. account or email note)" className={inputCls} />
          <input value={nomineeName} onChange={(e) => setNomineeName(e.target.value)} placeholder="Nominee name" className={inputCls} />
          <input value={nomineeContact} onChange={(e) => setNomineeContact(e.target.value)} placeholder="Nominee contact (email/phone)" className={inputCls} />
          <input value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder="Relationship (e.g. spouse, parent)" className={inputCls} />
          <div className="flex items-center gap-3">
            <button onClick={submit} disabled={busy || !siteId} className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-active disabled:opacity-60">
              {busy ? "Saving…" : "Record nominee"}
            </button>
            {error && <span className="text-sm text-amber">{error}</span>}
          </div>
        </div>
      </section>

      {rows.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg text-ink">Recorded nominations</h2>
          {rows.map((n) => (
            <div key={n.id} className="rounded-2xl border border-hairline p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-ink">{n.nomineeName ?? "(nominee)"}</span>
                <span className="text-xs text-muted">{NOMINATION_STATUS_LABELS[n.status]}</span>
              </div>
              <p className="mt-1 text-body">
                {n.domain}
                {n.relationship ? ` · ${n.relationship}` : ""}
                {n.principalRef ? ` · for ${n.principalRef}` : ""}
              </p>
              {n.nomineeContact && <p className="text-xs text-muted">{n.nomineeContact}</p>}
              <p className="mt-1 text-xs text-muted">
                Recorded {when.format(new Date(n.createdAt))}
                {n.activatedAt ? ` · activated ${when.format(new Date(n.activatedAt))}` : ""}
              </p>
              <div className="mt-2 flex gap-2">
                {n.status !== "activated" && (
                  <button onClick={() => move(n.id, "activated")} className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-white hover:bg-primary-active">
                    Activate (death/incapacity)
                  </button>
                )}
                {n.status !== "revoked" && (
                  <button onClick={() => move(n.id, "revoked")} className="rounded-full border border-hairline px-3 py-1 text-xs text-body hover:bg-surface-soft">
                    Revoke
                  </button>
                )}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
