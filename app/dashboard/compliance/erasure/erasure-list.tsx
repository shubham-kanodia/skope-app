"use client";

import { useState } from "react";
import { resolveErasure, signalCessationTask, setCessationTaskStatus } from "./actions";
import {
  ERASURE_KIND_LABELS,
  ERASURE_STATUS_LABELS,
  type ErasureRow,
  type ErasureStatus,
} from "@/lib/erasure/types";
import { CESSATION_STATUS_LABELS, type CessationTask } from "@/lib/cessation/types";

const when = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });

function dueMeta(dueAt: string, open: boolean): { text: string; tone: string } {
  if (!open) return { text: `Was due ${when.format(new Date(dueAt))}`, tone: "text-muted" };
  const days = Math.ceil((new Date(dueAt).getTime() - Date.now()) / 86400000);
  if (days < 0) return { text: `Overdue by ${-days} day${-days === 1 ? "" : "s"}`, tone: "text-amber font-semibold" };
  if (days === 0) return { text: "Due today", tone: "text-amber font-medium" };
  return { text: `Due in ${days} day${days === 1 ? "" : "s"}`, tone: days <= 7 ? "text-amber" : "text-body" };
}

export function ErasureList({
  initial,
  cessation,
}: {
  initial: ErasureRow[];
  cessation: Record<string, CessationTask[]>;
}) {
  const [rows, setRows] = useState(initial);

  function onChanged(id: string, status: ErasureStatus) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <Card key={r.id} row={r} onChanged={onChanged} tasks={cessation[r.id] ?? []} />
      ))}
    </div>
  );
}

function Card({
  row,
  onChanged,
  tasks,
}: {
  row: ErasureRow;
  onChanged: (id: string, s: ErasureStatus) => void;
  tasks: CessationTask[];
}) {
  const [note, setNote] = useState(row.resolutionNote ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = row.status === "open" || row.status === "in_progress";
  const due = dueMeta(row.dueAt, open);

  async function move(status: ErasureStatus) {
    setBusy(true);
    setError(null);
    const res = await resolveErasure(row.id, status, note);
    setBusy(false);
    if (res.error) return setError(res.error);
    onChanged(row.id, status);
  }

  return (
    <div className="rounded-2xl border border-hairline p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-surface-strong px-2.5 py-0.5 text-xs font-medium text-ink">
              {ERASURE_KIND_LABELS[row.kind]}
            </span>
            <span className="text-xs text-muted">{ERASURE_STATUS_LABELS[row.status]}</span>
          </div>
          <p className="mt-2 text-sm text-ink">
            {row.domain}
            {row.subjectId ? ` · subject ${row.subjectId.slice(0, 8)}…` : ""}
          </p>
          {row.basis && <p className="mt-1 text-xs text-muted">{row.basis}</p>}
        </div>
        <span className={`text-sm ${due.tone}`}>{due.text}</span>
      </div>

      {open ? (
        <div className="mt-4 space-y-3">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Note: what you erased / where, or why erasure isn't required (e.g. a legal retention obligation)"
            className="w-full rounded-xl border border-hairline bg-canvas px-4 py-2.5 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <div className="flex flex-wrap gap-2">
            {row.status === "open" && (
              <button
                onClick={() => move("in_progress")}
                disabled={busy}
                className="rounded-full border border-hairline px-4 py-2 text-sm font-medium text-ink hover:bg-surface-soft disabled:opacity-60"
              >
                Start
              </button>
            )}
            <button
              onClick={() => move("done")}
              disabled={busy}
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-active disabled:opacity-60"
            >
              Mark erased
            </button>
            <button
              onClick={() => move("not_required")}
              disabled={busy}
              className="rounded-full border border-hairline px-4 py-2 text-sm font-medium text-body hover:bg-surface-soft disabled:opacity-60"
            >
              Not required
            </button>
          </div>
          {error && <p className="text-sm text-amber">{error}</p>}
        </div>
      ) : (
        row.resolutionNote && <p className="mt-3 text-sm text-muted">Note: {row.resolutionNote}</p>
      )}

      {tasks.length > 0 && <CessationTasks tasks={tasks} />}
    </div>
  );
}

function CessationTasks({ tasks }: { tasks: CessationTask[] }) {
  const [rows, setRows] = useState(tasks);
  const [busy, setBusy] = useState<string | null>(null);

  function update(id: string, patch: Partial<CessationTask>) {
    setRows((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  async function signal(t: CessationTask) {
    setBusy(t.id);
    const res = await signalCessationTask(t.id);
    setBusy(null);
    if (!res.error) update(t.id, { status: "signalled" });
  }
  async function mark(t: CessationTask, status: CessationTask["status"]) {
    setBusy(t.id);
    const res = await setCessationTaskStatus(t.id, status, "");
    setBusy(null);
    if (!res.error) update(t.id, { status });
  }

  return (
    <div className="mt-4 border-t border-hairline pt-3">
      <p className="text-xs font-medium text-ink">Tell your vendors to stop too</p>
      <div className="mt-2 space-y-2">
        {rows.map((t) => (
          <div key={t.id} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-ink">{t.recipientName}</span>
            <span className="text-xs text-muted">{CESSATION_STATUS_LABELS[t.status]}</span>
            {t.status === "pending" && t.hasWebhook && (
              <button
                onClick={() => signal(t)}
                disabled={busy === t.id}
                className="rounded-full border border-hairline px-3 py-1 text-xs text-ink hover:bg-surface-soft disabled:opacity-60"
              >
                Signal webhook
              </button>
            )}
            {t.status !== "acknowledged" && t.status !== "manual_done" && (
              <>
                <button
                  onClick={() => mark(t, "acknowledged")}
                  disabled={busy === t.id}
                  className="rounded-full border border-hairline px-3 py-1 text-xs text-ink hover:bg-surface-soft disabled:opacity-60"
                >
                  Mark acknowledged
                </button>
                <button
                  onClick={() => mark(t, "manual_done")}
                  disabled={busy === t.id}
                  className="rounded-full border border-hairline px-3 py-1 text-xs text-body hover:bg-surface-soft disabled:opacity-60"
                >
                  Done manually
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
