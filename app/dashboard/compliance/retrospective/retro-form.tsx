"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { queueRetroNotice } from "./actions";

type SiteOption = { id: string; domain: string };

export function RetroForm({ sites }: { sites: SiteOption[] }) {
  const router = useRouter();
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [list, setList] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    setState("saving");
    setMsg(null);
    const res = await queueRetroNotice(siteId, list);
    if (res.error) {
      setState("error");
      setMsg(res.error);
      return;
    }
    setState("done");
    setMsg(`Queued ${res.queued} notice(s). They'll send shortly and appear below.`);
    setList("");
    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-hairline p-5">
      <h2 className="text-lg text-ink">Send your privacy notice</h2>
      <p className="mt-1 text-sm text-body">
        Paste the email addresses of people whose data you held before the Act. They&apos;ll each get
        your published privacy notice, and delivery is logged for your records. Make sure the site&apos;s
        notice is published first.
      </p>

      <div className="mt-4 space-y-3">
        <label className="block">
          <span className="text-xs font-medium text-ink">Site (whose notice to send)</span>
          <select
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-hairline bg-canvas px-4 py-2.5 text-sm text-ink outline-none focus:border-primary"
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.domain}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-ink">Email addresses</span>
          <textarea
            value={list}
            onChange={(e) => setList(e.target.value)}
            rows={6}
            placeholder="one per line, or comma-separated"
            className="mt-1 w-full rounded-xl border border-hairline bg-canvas px-4 py-2.5 text-sm text-ink outline-none focus:border-primary"
          />
        </label>

        <div className="flex items-center gap-3">
          <button
            onClick={submit}
            disabled={state === "saving" || !siteId}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-active disabled:opacity-60"
          >
            {state === "saving" ? "Queuing…" : "Queue broadcast"}
          </button>
          {msg && <span className={`text-sm ${state === "error" ? "text-amber" : "text-success"}`}>{msg}</span>}
        </div>
      </div>
    </section>
  );
}
