"use client";

import { useState } from "react";
import {
  updateSdfSettings,
  addDpia,
  addAuditorRecord,
  setAuditCadence,
  markAuditComplete,
} from "./actions";
import type { SdfSettings, DpiaRow, AuditorRow, AuditScheduleRow } from "@/lib/sdf/store";

const when = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });
const inputCls =
  "w-full rounded-xl border border-hairline bg-canvas px-4 py-2.5 text-sm text-ink outline-none focus:border-primary";

const DPIA_FIELDS: { key: string; label: string }[] = [
  { key: "processing", label: "What processing does this cover?" },
  { key: "necessity", label: "Why is it necessary and proportionate?" },
  { key: "risks", label: "Risks to data principals" },
  { key: "mitigations", label: "Safeguards and mitigations" },
  { key: "residual", label: "Residual risk and sign-off" },
];

export function SdfManager({
  settings,
  dpias,
  auditors,
  schedule,
}: {
  settings: SdfSettings;
  dpias: DpiaRow[];
  auditors: AuditorRow[];
  schedule: AuditScheduleRow | null;
}) {
  const [s, setS] = useState(settings);
  const [savingSettings, setSavingSettings] = useState(false);

  async function saveSettings() {
    setSavingSettings(true);
    await updateSdfSettings(s);
    setSavingSettings(false);
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-hairline p-5">
        <h2 className="text-lg text-ink">Designation</h2>
        <p className="mt-1 text-sm text-body">
          Turn this on only if the government has officially named you a Significant Data Fiduciary.
          It unlocks the extra duties below.
        </p>
        <div className="mt-4 space-y-3">
          <label className="flex items-start gap-3">
            <input type="checkbox" checked={s.isSdf} onChange={(e) => setS({ ...s, isSdf: e.target.checked })} className="mt-1" />
            <span className="text-sm text-ink">We are a notified Significant Data Fiduciary</span>
          </label>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={s.dpoIndiaBased}
              onChange={(e) => setS({ ...s, dpoIndiaBased: e.target.checked })}
              className="mt-1"
            />
            <span className="text-sm text-ink">Our data protection officer is based in India</span>
          </label>
          <div className="flex flex-wrap gap-3">
            <label className="block min-w-48 flex-1">
              <span className="text-xs font-medium text-ink">DPO name</span>
              <input value={s.dpoName} onChange={(e) => setS({ ...s, dpoName: e.target.value })} className={`mt-1 ${inputCls}`} />
            </label>
            <label className="block min-w-48 flex-1">
              <span className="text-xs font-medium text-ink">DPO email</span>
              <input value={s.dpoEmail} onChange={(e) => setS({ ...s, dpoEmail: e.target.value })} className={`mt-1 ${inputCls}`} />
            </label>
          </div>
        </div>
        <button
          onClick={saveSettings}
          disabled={savingSettings}
          className="mt-4 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-active disabled:opacity-60"
        >
          {savingSettings ? "Saving…" : "Save designation"}
        </button>
      </section>

      {s.isSdf && (
        <>
          <DpiaSection dpias={dpias} />
          <AuditorSection auditors={auditors} />
          <ScheduleSection schedule={schedule} />
        </>
      )}
    </div>
  );
}

function DpiaSection({ dpias }: { dpias: DpiaRow[] }) {
  const [title, setTitle] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  async function submit(final: boolean) {
    setBusy(true);
    const res = await addDpia(title, answers, final);
    setBusy(false);
    if (!res.error) {
      setTitle("");
      setAnswers({});
      setOpen(false);
    }
  }

  return (
    <section className="rounded-2xl border border-hairline p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg text-ink">Risk assessments</h2>
        <button onClick={() => setOpen((o) => !o)} className="text-sm text-primary hover:text-primary-active">
          {open ? "Cancel" : "New DPIA"}
        </button>
      </div>

      {open && (
        <div className="mt-4 space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="DPIA title" className={inputCls} />
          {DPIA_FIELDS.map((f) => (
            <label key={f.key} className="block">
              <span className="text-xs font-medium text-ink">{f.label}</span>
              <textarea
                rows={2}
                value={answers[f.key] ?? ""}
                onChange={(e) => setAnswers((a) => ({ ...a, [f.key]: e.target.value }))}
                className={`mt-1 ${inputCls}`}
              />
            </label>
          ))}
          <div className="flex gap-2">
            <button onClick={() => submit(false)} disabled={busy} className="rounded-full border border-hairline px-4 py-2 text-sm text-ink hover:bg-surface-soft disabled:opacity-60">
              Save draft
            </button>
            <button onClick={() => submit(true)} disabled={busy} className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-active disabled:opacity-60">
              Save as final
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {dpias.length === 0 ? (
          <p className="text-sm text-muted">No DPIAs recorded yet.</p>
        ) : (
          dpias.map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-xl border border-hairline px-4 py-3 text-sm">
              <span className="text-ink">{d.title}</span>
              <span className="text-xs text-muted">
                {d.status} · {when.format(new Date(d.createdAt))}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function AuditorSection({ auditors }: { auditors: AuditorRow[] }) {
  const [name, setName] = useState("");
  const [firm, setFirm] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const res = await addAuditorRecord(name, firm, email);
    setBusy(false);
    if (!res.error) {
      setName("");
      setFirm("");
      setEmail("");
    }
  }

  return (
    <section className="rounded-2xl border border-hairline p-5">
      <h2 className="text-lg text-ink">Independent auditor</h2>
      <div className="mt-4 flex flex-wrap gap-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Auditor name" className={`${inputCls} min-w-40 flex-1`} />
        <input value={firm} onChange={(e) => setFirm(e.target.value)} placeholder="Firm" className={`${inputCls} min-w-40 flex-1`} />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Contact email" className={`${inputCls} min-w-40 flex-1`} />
      </div>
      <button onClick={submit} disabled={busy} className="mt-3 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-active disabled:opacity-60">
        {busy ? "Saving…" : "Add auditor"}
      </button>
      <div className="mt-4 space-y-2">
        {auditors.map((a) => (
          <div key={a.id} className="rounded-xl border border-hairline px-4 py-3 text-sm">
            <span className="text-ink">{a.name}</span>
            {a.firm && <span className="text-muted"> · {a.firm}</span>}
            {a.contactEmail && <span className="text-muted"> · {a.contactEmail}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}

function ScheduleSection({ schedule }: { schedule: AuditScheduleRow | null }) {
  const [cadence, setCadence] = useState(String(schedule?.cadenceDays ?? 365));
  const [busy, setBusy] = useState<string | null>(null);

  return (
    <section className="rounded-2xl border border-hairline p-5">
      <h2 className="text-lg text-ink">How often you audit</h2>
      {schedule?.nextDueAt && (
        <p className="mt-1 text-sm text-body">
          Next audit due {when.format(new Date(schedule.nextDueAt))}
          {schedule.lastCompletedAt ? ` · last completed ${when.format(new Date(schedule.lastCompletedAt))}` : ""}
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-xs font-medium text-ink">Audit every (days)</span>
          <input
            type="number"
            min={30}
            value={cadence}
            onChange={(e) => setCadence(e.target.value)}
            className={`mt-1 w-40 ${inputCls}`}
          />
        </label>
        <button
          onClick={async () => {
            setBusy("save");
            await setAuditCadence(Number(cadence));
            setBusy(null);
          }}
          disabled={busy !== null}
          className="rounded-full border border-hairline px-4 py-2 text-sm font-medium text-ink hover:bg-surface-soft disabled:opacity-60"
        >
          Save cadence
        </button>
        <button
          onClick={async () => {
            setBusy("done");
            await markAuditComplete();
            setBusy(null);
          }}
          disabled={busy !== null}
          className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-active disabled:opacity-60"
        >
          Mark audit complete
        </button>
      </div>
    </section>
  );
}
