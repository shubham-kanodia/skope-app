"use client";

import { useState } from "react";
import { updateRequest, markFrivolous } from "./actions";
import type { RequestRow, RequestStatus } from "@/lib/requests/store";

const TYPE_LABEL: Record<string, string> = {
  access: "Access",
  correction: "Correction",
  erasure: "Erasure",
  nomination: "Nomination",
  grievance: "Grievance",
};

const STATUS_LABEL: Record<string, string> = {
  new: "New",
  in_progress: "In progress",
  done: "Done",
  rejected: "Rejected",
};

const when = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });

function dueMeta(dueAt: string | null, open: boolean): { text: string; tone: string } {
  if (!dueAt) return { text: "No due date", tone: "text-muted" };
  const days = Math.ceil((new Date(dueAt).getTime() - Date.now()) / 86400000);
  if (!open) return { text: `Was due ${when.format(new Date(dueAt))}`, tone: "text-muted" };
  if (days < 0) return { text: `Overdue by ${-days} day${-days === 1 ? "" : "s"}`, tone: "text-amber font-semibold" };
  if (days === 0) return { text: "Due today", tone: "text-amber font-medium" };
  return { text: `Due in ${days} day${days === 1 ? "" : "s"}`, tone: days <= 3 ? "text-amber" : "text-body" };
}

export function RequestsList({ initial }: { initial: RequestRow[] }) {
  const [rows, setRows] = useState(initial);

  function onChanged(id: string, status: RequestStatus) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <Card key={r.id} row={r} onChanged={onChanged} />
      ))}
    </div>
  );
}

function Card({ row, onChanged }: { row: RequestRow; onChanged: (id: string, s: RequestStatus) => void }) {
  const [note, setNote] = useState(row.resolutionNote ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [frivolous, setFrivolous] = useState(row.frivolous);
  const open = row.status === "new" || row.status === "in_progress";
  const due = dueMeta(row.dueAt, open);

  async function toggleFrivolous() {
    const next = !frivolous;
    setFrivolous(next);
    const res = await markFrivolous(row.id, next);
    if (res.error) setFrivolous(!next);
  }

  async function move(status: RequestStatus) {
    setBusy(true);
    setError(null);
    const res = await updateRequest(row.id, status, note);
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
              {TYPE_LABEL[row.type] ?? row.type}
            </span>
            <span className="text-xs text-muted">{STATUS_LABEL[row.status] ?? row.status}</span>
            {frivolous && (
              <span className="rounded-full bg-amber/10 px-2 py-0.5 text-xs font-medium text-amber">Flagged frivolous</span>
            )}
          </div>
          <p className="mt-2 text-sm text-ink">{row.email ?? "Email unavailable"}</p>
          <p className="text-xs text-muted">
            {row.domain} · received {when.format(new Date(row.createdAt))}
          </p>
        </div>
        <span className={`text-sm ${due.tone}`}>{due.text}</span>
      </div>

      {row.detail && <p className="mt-3 rounded-xl bg-surface-soft px-4 py-3 text-sm text-body">{row.detail}</p>}

      {row.type === "grievance" && (
        <button onClick={toggleFrivolous} className="mt-3 block text-xs text-muted hover:text-amber">
          {frivolous ? "Clear frivolous flag" : "Flag as frivolous"}
        </button>
      )}

      {row.type === "access" && (
        <p className="mt-3 text-sm">
          <a
            href={`/api/dashboard/requests/${row.id}/access-summary`}
            target="_blank"
            rel="noopener"
            className="text-primary hover:text-primary-active"
          >
            Generate data summary (PDF)
          </a>
          <span className="ml-2 text-xs text-muted">Verify the requester&apos;s identity before sending.</span>
        </p>
      )}

      {open ? (
        <div className="mt-4 space-y-3">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Resolution note (emailed to the requester when you close this)"
            className="w-full rounded-xl border border-hairline bg-canvas px-4 py-2.5 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <div className="flex flex-wrap gap-2">
            {row.status === "new" && (
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
              Mark done
            </button>
            <button
              onClick={() => move("rejected")}
              disabled={busy}
              className="rounded-full border border-hairline px-4 py-2 text-sm font-medium text-body hover:bg-surface-soft disabled:opacity-60"
            >
              Reject
            </button>
          </div>
          {error && <p className="text-sm text-ink">{error}</p>}
        </div>
      ) : (
        row.resolutionNote && <p className="mt-3 text-sm text-muted">Note: {row.resolutionNote}</p>
      )}
    </div>
  );
}
