"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { markBreachNotified, setBreachStatus } from "./actions";
import {
  BREACH_STATUSES,
  BREACH_STATUS_LABELS,
  type BreachStatus,
  type BreachNotification,
} from "@/lib/breach/types";

type Draft = { subject: string; body: string };

export function BreachDetail({
  id,
  status,
  estAffected,
  boardNotifiedAt,
  principalsNotifiedAt,
  boardDraft,
  principalDraft,
  notifications,
}: {
  id: string;
  status: BreachStatus;
  estAffected: number | null;
  boardNotifiedAt: string | null;
  principalsNotifiedAt: string | null;
  boardDraft: Draft;
  principalDraft: Draft;
  notifications: BreachNotification[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recipientCount, setRecipientCount] = useState(estAffected != null ? String(estAffected) : "");

  async function run(key: string, fn: () => Promise<{ error?: string }>) {
    setBusy(key);
    setError(null);
    const res = await fn();
    setBusy(null);
    if (res.error) return setError(res.error);
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-lg text-ink">Status</h2>
        <div className="flex flex-wrap gap-2">
          {BREACH_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => run(`status-${s}`, () => setBreachStatus(id, s))}
              disabled={busy !== null || s === status}
              className={`rounded-full border px-3 py-1.5 text-xs ${
                s === status
                  ? "border-primary bg-primary/10 font-medium text-primary"
                  : "border-hairline text-body hover:bg-surface-soft disabled:opacity-60"
              }`}
            >
              {BREACH_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </section>

      <NoticeBlock
        title="Notice to the Data Protection Board"
        draft={boardDraft}
        notifiedAt={boardNotifiedAt}
        action={
          <button
            onClick={() => run("notify-board", () => markBreachNotified(id, "board", null))}
            disabled={busy !== null}
            className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-active disabled:opacity-60"
          >
            {boardNotifiedAt ? "Record again" : "Mark Board notified"}
          </button>
        }
      />

      <NoticeBlock
        title="Notice to affected people"
        draft={principalDraft}
        notifiedAt={principalsNotifiedAt}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-muted">
              People notified
              <input
                type="number"
                min={0}
                value={recipientCount}
                onChange={(e) => setRecipientCount(e.target.value)}
                className="ml-2 w-28 rounded-lg border border-hairline bg-canvas px-3 py-1.5 text-sm text-ink outline-none focus:border-primary"
              />
            </label>
            <button
              onClick={() =>
                run("notify-principals", () =>
                  markBreachNotified(id, "principals", recipientCount ? Number(recipientCount) : null),
                )
              }
              disabled={busy !== null}
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-active disabled:opacity-60"
            >
              {principalsNotifiedAt ? "Record again" : "Mark people notified"}
            </button>
          </div>
        }
      />

      {error && <p className="text-sm text-amber">{error}</p>}

      {notifications.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg text-ink">Notification log</h2>
          <div className="space-y-2">
            {notifications.map((n) => (
              <div key={n.id} className="rounded-xl border border-hairline px-4 py-3 text-sm">
                <span className="font-medium text-ink">
                  {n.audience === "board" ? "Board" : "Affected people"}
                </span>
                <span className="text-muted">
                  {" "}
                  · {new Date(n.sentAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} · via{" "}
                  {n.channel}
                  {n.recipientCount != null ? ` · ${n.recipientCount} recipients` : ""}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function NoticeBlock({
  title,
  draft,
  notifiedAt,
  action,
}: {
  title: string;
  draft: Draft;
  notifiedAt: string | null;
  action: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable; the user can still select the text
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg text-ink">{title}</h2>
        {notifiedAt && (
          <span className="text-xs text-success">
            Sent {new Date(notifiedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
          </span>
        )}
      </div>
      <div className="rounded-2xl border border-hairline bg-surface-soft p-4">
        <p className="text-sm font-medium text-ink">{draft.subject}</p>
        <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-body">{draft.body}</pre>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={copy}
          className="rounded-full border border-hairline px-4 py-2 text-sm font-medium text-ink hover:bg-surface-soft"
        >
          {copied ? "Copied" : "Copy"}
        </button>
        {action}
      </div>
    </section>
  );
}
